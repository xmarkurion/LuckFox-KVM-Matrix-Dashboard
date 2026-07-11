from __future__ import annotations

import json
import os
import platform
import re
import socket
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

import psutil
from fastapi import Depends, FastAPI, Header, HTTPException, status
from pydantic import BaseModel, Field

APP_NAME = "luckfox-host-script-agent"
LEGACY_SCRIPT_PATH = Path(os.getenv("SCRIPT_PATH", "/scripts/host_action.py"))
SCRIPTS_DIR = Path(os.getenv("SCRIPTS_DIR", str(LEGACY_SCRIPT_PATH.parent)))
DEFAULT_SCRIPT_ID = os.getenv("DEFAULT_SCRIPT_ID", LEGACY_SCRIPT_PATH.stem or "host_action")
DEFAULT_TIMEOUT_SECONDS = float(os.getenv("SCRIPT_TIMEOUT_SECONDS", "60"))
AGENT_TOKEN = os.getenv("AGENT_TOKEN", "change-me-agent-token")
SCRIPT_CWD = os.getenv("SCRIPT_CWD", str(SCRIPTS_DIR))
HOST_PROC_PATH = os.getenv("HOST_PROC_PATH", "/host/proc")
HOST_ROOT_PATH = Path(os.getenv("HOST_ROOT_PATH", "/host/root"))
MAX_PROCESSES = int(os.getenv("STATS_MAX_PROCESSES", "8"))
SCRIPT_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]+$")

# When /proc from the host is mounted into the container, psutil can use it.
# Without the mount, these calls still work, but they describe the container / Docker VM view.
if Path(HOST_PROC_PATH).exists():
    psutil.PROCFS_PATH = HOST_PROC_PATH

app = FastAPI(title="LuckFox Host Script Agent", version="1.4.1")


class KvmContext(BaseModel):
    id: str = ""
    name: str = ""
    ip: str = ""
    notes: str = ""
    websiteUrl: str = ""


class RunRequest(BaseModel):
    kvm: KvmContext = Field(default_factory=KvmContext)
    payload: dict[str, Any] = Field(default_factory=dict)
    scriptId: str = DEFAULT_SCRIPT_ID
    scriptLabel: str = ""
    timeoutSeconds: float | None = None


class RunResponse(BaseModel):
    ok: bool
    scriptId: str
    scriptLabel: str
    script: str
    exitCode: int
    durationMs: int
    stdout: str
    stderr: str


def safe_script_id(script_id: str | None) -> str:
    resolved = (script_id or DEFAULT_SCRIPT_ID).strip()
    if not resolved:
        resolved = DEFAULT_SCRIPT_ID
    if not SCRIPT_ID_PATTERN.fullmatch(resolved):
        raise HTTPException(status_code=400, detail="scriptId may contain only letters, numbers, underscore, and dash")
    return resolved


def script_path_for(script_id: str | None) -> Path:
    resolved_id = safe_script_id(script_id)
    script_path = (SCRIPTS_DIR / f"{resolved_id}.py").resolve()
    scripts_root = SCRIPTS_DIR.resolve()
    try:
        script_path.relative_to(scripts_root)
    except ValueError:
        raise HTTPException(status_code=400, detail="Resolved script path escaped SCRIPTS_DIR")
    return script_path


def available_scripts() -> list[dict[str, str]]:
    if not SCRIPTS_DIR.exists():
        return []
    scripts: list[dict[str, str]] = []
    for path in sorted(SCRIPTS_DIR.glob("*.py")):
        if path.name.startswith("."):
            continue
        scripts.append({
            "id": path.stem,
            "filename": path.name,
            "path": str(path),
        })
    return scripts


def verify_token(
    authorization: str | None = Header(default=None),
    x_agent_token: str | None = Header(default=None),
) -> None:
    """Require a shared token unless AGENT_TOKEN is intentionally empty."""
    if not AGENT_TOKEN:
        return

    bearer = ""
    if authorization and authorization.lower().startswith("bearer "):
        bearer = authorization[7:].strip()

    if x_agent_token == AGENT_TOKEN or bearer == AGENT_TOKEN:
        return

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or missing host script agent token",
    )


def read_text(path: Path) -> str | None:
    try:
        return path.read_text(encoding="utf-8").strip()
    except OSError:
        return None


def read_os_release() -> dict[str, str]:
    candidates = [Path("/etc/os-release")]
    if HOST_ROOT_PATH.exists():
        candidates.insert(0, HOST_ROOT_PATH / "etc/os-release")

    for candidate in candidates:
        text = read_text(candidate)
        if not text:
            continue
        result: dict[str, str] = {}
        for line in text.splitlines():
            if "=" not in line or line.startswith("#"):
                continue
            key, value = line.split("=", 1)
            result[key] = value.strip().strip('"')
        if result:
            return result
    return {}


def read_cgroup_stats() -> dict[str, Any]:
    cgroup_root = Path("/sys/fs/cgroup")
    memory_max_raw = read_text(cgroup_root / "memory.max")
    memory_current_raw = read_text(cgroup_root / "memory.current")
    cpu_max_raw = read_text(cgroup_root / "cpu.max")
    pids_current_raw = read_text(cgroup_root / "pids.current")
    pids_max_raw = read_text(cgroup_root / "pids.max")

    def parse_int(value: str | None) -> int | None:
        if not value or value == "max":
            return None
        try:
            return int(value)
        except ValueError:
            return None

    cpu_quota = None
    cpu_period = None
    cpu_limit_cores = None
    if cpu_max_raw:
        parts = cpu_max_raw.split()
        if len(parts) >= 2:
            cpu_quota = parse_int(parts[0])
            cpu_period = parse_int(parts[1])
            if cpu_quota and cpu_period:
                cpu_limit_cores = round(cpu_quota / cpu_period, 3)

    return {
        "memoryCurrentBytes": parse_int(memory_current_raw),
        "memoryMaxBytes": parse_int(memory_max_raw),
        "cpuMaxRaw": cpu_max_raw,
        "cpuQuotaMicros": cpu_quota,
        "cpuPeriodMicros": cpu_period,
        "cpuLimitCores": cpu_limit_cores,
        "pidsCurrent": parse_int(pids_current_raw),
        "pidsMax": parse_int(pids_max_raw),
    }


def disk_usage_for(path_value: str) -> dict[str, Any] | None:
    try:
        usage = psutil.disk_usage(path_value)
        return {
            "path": path_value,
            "totalBytes": usage.total,
            "usedBytes": usage.used,
            "freeBytes": usage.free,
            "percent": usage.percent,
        }
    except OSError:
        return None


def get_disk_stats() -> list[dict[str, Any]]:
    seen: set[str] = set()
    disks: list[dict[str, Any]] = []

    # Always report container root because it is guaranteed to exist.
    root_usage = disk_usage_for("/")
    if root_usage:
        root_usage.update({"device": "container-root", "mountpoint": "/", "fstype": "container"})
        disks.append(root_usage)
        seen.add("/")

    # If the host root is mounted, report that too.
    if HOST_ROOT_PATH.exists():
        host_root_usage = disk_usage_for(str(HOST_ROOT_PATH))
        if host_root_usage:
            host_root_usage.update({"device": "host-root", "mountpoint": str(HOST_ROOT_PATH), "fstype": "host"})
            disks.append(host_root_usage)
            seen.add(str(HOST_ROOT_PATH))

    for partition in psutil.disk_partitions(all=False):
        if partition.mountpoint in seen:
            continue
        usage = disk_usage_for(partition.mountpoint)
        if not usage:
            continue
        usage.update({
            "device": partition.device,
            "mountpoint": partition.mountpoint,
            "fstype": partition.fstype,
        })
        disks.append(usage)
        seen.add(partition.mountpoint)
    return disks[:16]


def get_network_stats() -> dict[str, Any]:
    counters = psutil.net_io_counters(pernic=True)
    addrs = psutil.net_if_addrs()
    interfaces: list[dict[str, Any]] = []
    for name, counter in counters.items():
        addresses: list[str] = []
        for address in addrs.get(name, []):
            if address.family in (socket.AF_INET, socket.AF_INET6):
                addresses.append(address.address)
        interfaces.append({
            "name": name,
            "addresses": addresses,
            "bytesSent": counter.bytes_sent,
            "bytesRecv": counter.bytes_recv,
            "packetsSent": counter.packets_sent,
            "packetsRecv": counter.packets_recv,
            "errorsIn": counter.errin,
            "errorsOut": counter.errout,
            "dropsIn": counter.dropin,
            "dropsOut": counter.dropout,
        })
    return {"interfaces": interfaces}


def get_top_processes(limit: int = MAX_PROCESSES) -> list[dict[str, Any]]:
    processes: list[dict[str, Any]] = []
    for proc in psutil.process_iter(["pid", "name", "username", "status", "cpu_percent", "memory_percent", "create_time"]):
        try:
            info = proc.info
            processes.append({
                "pid": info.get("pid"),
                "name": info.get("name") or "unknown",
                "username": info.get("username") or "",
                "status": info.get("status") or "",
                "cpuPercent": round(float(info.get("cpu_percent") or 0.0), 2),
                "memoryPercent": round(float(info.get("memory_percent") or 0.0), 2),
                "createTime": info.get("create_time"),
            })
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
    processes.sort(key=lambda item: (float(item.get("memoryPercent") or 0), float(item.get("cpuPercent") or 0)), reverse=True)
    return processes[:limit]


def get_temperature_stats() -> dict[str, Any]:
    try:
        temps = psutil.sensors_temperatures(fahrenheit=False)
    except (AttributeError, OSError):
        temps = {}
    result: dict[str, Any] = {}
    for chip, entries in temps.items():
        result[chip] = [
            {
                "label": entry.label,
                "currentC": entry.current,
                "highC": entry.high,
                "criticalC": entry.critical,
            }
            for entry in entries
        ]
    return result


def collect_stats() -> dict[str, Any]:
    boot_time = psutil.boot_time()
    memory = psutil.virtual_memory()
    swap = psutil.swap_memory()
    cpu_freq = psutil.cpu_freq()
    os_release = read_os_release()

    try:
        load_average = os.getloadavg()
    except OSError:
        load_average = None

    stats = {
        "ok": True,
        "service": APP_NAME,
        "collectedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "hostname": socket.gethostname(),
        "platform": {
            "system": platform.system(),
            "release": platform.release(),
            "version": platform.version(),
            "machine": platform.machine(),
            "pythonVersion": platform.python_version(),
            "osName": os_release.get("PRETTY_NAME") or platform.platform(),
        },
        "docker": {
            "containerized": Path("/.dockerenv").exists() or bool(os.getenv("container")),
            "psutilProcfsPath": psutil.PROCFS_PATH,
            "hostProcMounted": Path(HOST_PROC_PATH).exists(),
            "hostRootMounted": HOST_ROOT_PATH.exists(),
            "cgroup": read_cgroup_stats(),
        },
        "uptimeSeconds": max(0, int(time.time() - boot_time)),
        "bootTime": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(boot_time)),
        "cpu": {
            "percent": psutil.cpu_percent(interval=0.15),
            "countLogical": psutil.cpu_count(logical=True),
            "countPhysical": psutil.cpu_count(logical=False),
            "loadAverage": list(load_average) if load_average else None,
            "frequencyMhz": {
                "current": cpu_freq.current,
                "min": cpu_freq.min,
                "max": cpu_freq.max,
            } if cpu_freq else None,
        },
        "memory": {
            "totalBytes": memory.total,
            "availableBytes": memory.available,
            "usedBytes": memory.used,
            "freeBytes": memory.free,
            "percent": memory.percent,
        },
        "swap": {
            "totalBytes": swap.total,
            "usedBytes": swap.used,
            "freeBytes": swap.free,
            "percent": swap.percent,
        },
        "disks": get_disk_stats(),
        "network": get_network_stats(),
        "temperatures": get_temperature_stats(),
        "topProcesses": get_top_processes(),
    }

    try:
        battery = psutil.sensors_battery()
    except (AttributeError, OSError):
        battery = None
    if battery:
        stats["battery"] = {
            "percent": battery.percent,
            "secondsLeft": battery.secsleft,
            "powerPlugged": battery.power_plugged,
        }

    return stats


@app.get("/health")
def health() -> dict[str, Any]:
    default_script_path = script_path_for(DEFAULT_SCRIPT_ID)
    return {
        "ok": True,
        "service": APP_NAME,
        "scriptsDir": str(SCRIPTS_DIR),
        "defaultScriptId": DEFAULT_SCRIPT_ID,
        "defaultScriptPath": str(default_script_path),
        "defaultScriptExists": default_script_path.exists(),
        "availableScripts": available_scripts(),
        "statsEnabled": True,
    }


@app.get("/scripts", dependencies=[Depends(verify_token)])
def scripts() -> dict[str, Any]:
    return {
        "ok": True,
        "defaultScriptId": DEFAULT_SCRIPT_ID,
        "scripts": available_scripts(),
    }


@app.get("/stats", dependencies=[Depends(verify_token)])
def stats() -> dict[str, Any]:
    return collect_stats()


@app.post("/run", response_model=RunResponse, dependencies=[Depends(verify_token)])
def run_script(request: RunRequest) -> RunResponse:
    script_id = safe_script_id(request.scriptId)
    script_path = script_path_for(script_id)
    if not script_path.exists():
        raise HTTPException(status_code=500, detail=f"Script not found: {script_path}")
    if not script_path.is_file():
        raise HTTPException(status_code=500, detail=f"Script path is not a file: {script_path}")

    timeout = request.timeoutSeconds or DEFAULT_TIMEOUT_SECONDS
    if timeout <= 0 or timeout > 3600:
        raise HTTPException(status_code=400, detail="timeoutSeconds must be between 1 and 3600")

    env = os.environ.copy()
    env.update(
        {
            "HOST_SCRIPT_ID": script_id,
            "HOST_SCRIPT_LABEL": request.scriptLabel,
            "HOST_SCRIPT_PATH": str(script_path),
            "KVM_ID": request.kvm.id,
            "KVM_NAME": request.kvm.name,
            "KVM_IP": request.kvm.ip,
            "KVM_NOTES": request.kvm.notes,
            "KVM_WEBSITE_URL": request.kvm.websiteUrl,
            "KVM_PAYLOAD_JSON": json.dumps(request.payload),
        }
    )

    input_payload = {
        "script": {"id": script_id, "label": request.scriptLabel, "path": str(script_path)},
        "kvm": request.kvm.model_dump(),
        "payload": request.payload,
    }

    started = time.perf_counter()
    try:
        completed = subprocess.run(
            [sys.executable, str(script_path)],
            cwd=SCRIPT_CWD if Path(SCRIPT_CWD).exists() else str(script_path.parent),
            env=env,
            input=json.dumps(input_payload),
            text=True,
            capture_output=True,
            timeout=timeout,
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        duration_ms = int((time.perf_counter() - started) * 1000)
        return RunResponse(
            ok=False,
            scriptId=script_id,
            scriptLabel=request.scriptLabel,
            script=str(script_path),
            exitCode=124,
            durationMs=duration_ms,
            stdout=exc.stdout or "",
            stderr=f"Script timed out after {timeout} seconds",
        )

    duration_ms = int((time.perf_counter() - started) * 1000)
    return RunResponse(
        ok=completed.returncode == 0,
        scriptId=script_id,
        scriptLabel=request.scriptLabel,
        script=str(script_path),
        exitCode=completed.returncode,
        durationMs=duration_ms,
        stdout=completed.stdout,
        stderr=completed.stderr,
    )
