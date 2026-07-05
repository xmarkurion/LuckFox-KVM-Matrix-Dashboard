#!/usr/bin/env python3
"""Reboot the host machine from the LuckFox Host Script Agent.

This script is intentionally guarded because it can immediately reboot the PC.
Set ALLOW_HOST_POWER_COMMANDS=true in the host-agent container environment before
using it. When the agent runs inside Docker on Linux, host reboot usually also
requires the container to run with `privileged: true` and `pid: host`.

Optional overrides:
  REBOOT_COMMAND="/path/to/your-command arg1 arg2"
  ALLOW_SYSRQ_FORCE=true  # last-resort immediate kernel reboot fallback
"""

from __future__ import annotations

import json
import os
import platform
import shlex
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


SUCCESS_CODES = {0}


def bool_env(name: str) -> bool:
    return os.getenv(name, "").strip().lower() in {"1", "true", "yes", "on"}


def load_context() -> dict[str, Any]:
    try:
        return json.loads(sys.stdin.read() or "{}")
    except json.JSONDecodeError:
        return {}


def command_candidates() -> list[list[str]]:
    override = os.getenv("REBOOT_COMMAND", "").strip()
    if override:
        return [shlex.split(override)]

    system = platform.system().lower()
    if system == "windows":
        return [["shutdown", "/r", "/f", "/t", "0"]]

    candidates: list[list[str]] = []

    if shutil.which("nsenter"):
        nsenter_prefix = ["nsenter", "--target", "1", "--mount", "--uts", "--ipc", "--net", "--pid", "--"]
        candidates.extend([
            [*nsenter_prefix, "systemctl", "reboot", "--force", "--force"],
            [*nsenter_prefix, "shutdown", "-r", "now"],
            [*nsenter_prefix, "reboot", "-f"],
        ])

    candidates.extend([
        ["systemctl", "reboot", "--force", "--force"],
        ["shutdown", "-r", "now"],
        ["reboot", "-f"],
    ])
    return candidates


def run_all_until_success(commands: list[list[str]]) -> tuple[bool, list[dict[str, Any]]]:
    attempts: list[dict[str, Any]] = []
    for command in commands:
        binary = command[0]
        if shutil.which(binary) is None:
            attempts.append({"command": command, "exitCode": 127, "stdout": "", "stderr": f"missing binary: {binary}"})
            continue
        try:
            completed = subprocess.run(command, text=True, capture_output=True, timeout=10, check=False)
            attempts.append({"command": command, "exitCode": completed.returncode, "stdout": completed.stdout, "stderr": completed.stderr})
            if completed.returncode in SUCCESS_CODES:
                return True, attempts
        except subprocess.TimeoutExpired as exc:
            attempts.append({"command": command, "exitCode": 124, "stdout": exc.stdout or "", "stderr": f"Command timed out: {' '.join(command)}"})
        except OSError as exc:
            attempts.append({"command": command, "exitCode": 126, "stdout": "", "stderr": str(exc)})
    return False, attempts


def write_sysrq(value: str, attempts: list[dict[str, Any]]) -> bool:
    candidates = [Path("/proc/sysrq-trigger")]
    host_proc = os.getenv("HOST_PROC_PATH", "/host/proc")
    if host_proc:
        candidates.append(Path(host_proc) / "sysrq-trigger")

    for candidate in candidates:
        try:
            candidate.write_text(value, encoding="utf-8")
            attempts.append({"command": ["write", str(candidate), value], "exitCode": 0, "stdout": "", "stderr": ""})
            return True
        except OSError as exc:
            attempts.append({"command": ["write", str(candidate), value], "exitCode": 126, "stdout": "", "stderr": str(exc)})
    return False


def try_sysrq_reboot(attempts: list[dict[str, Any]]) -> bool:
    if not bool_env("ALLOW_SYSRQ_FORCE"):
        attempts.append({"command": ["sysrq", "reboot"], "exitCode": 2, "stdout": "", "stderr": "Skipped last-resort SysRq reboot. Set ALLOW_SYSRQ_FORCE=true to enable it."})
        return False

    try:
        Path("/proc/sys/kernel/sysrq").write_text("1", encoding="utf-8")
        attempts.append({"command": ["write", "/proc/sys/kernel/sysrq", "1"], "exitCode": 0, "stdout": "", "stderr": ""})
    except OSError as exc:
        attempts.append({"command": ["write", "/proc/sys/kernel/sysrq", "1"], "exitCode": 126, "stdout": "", "stderr": str(exc)})

    for key in ["s", "u", "b"]:
        ok = write_sysrq(key, attempts)
        if not ok:
            return False
    return True


def main() -> int:
    context = load_context()
    script_id = context.get("script", {}).get("id") or os.getenv("HOST_SCRIPT_ID", "reboot_pc")
    script_label = context.get("script", {}).get("label") or os.getenv("HOST_SCRIPT_LABEL", "Reboot PC")

    if not bool_env("ALLOW_HOST_POWER_COMMANDS"):
        print(json.dumps({
            "ok": False,
            "at": datetime.now(timezone.utc).isoformat(),
            "scriptId": script_id,
            "scriptLabel": script_label,
            "message": "Blocked. ALLOW_HOST_POWER_COMMANDS is not true inside the running container.",
            "currentValue": os.getenv("ALLOW_HOST_POWER_COMMANDS", ""),
            "hint": "After editing docker-compose.yaml, recreate the agent: docker compose up -d --force-recreate --build. Verify with: docker exec luckfox-host-script-agent printenv ALLOW_HOST_POWER_COMMANDS",
        }, indent=2))
        return 2

    ok, attempts = run_all_until_success(command_candidates())
    if not ok:
        ok = try_sysrq_reboot(attempts)

    last_exit_code = 0 if ok else (attempts[-1]["exitCode"] if attempts else 127)
    print(json.dumps({
        "ok": ok,
        "at": datetime.now(timezone.utc).isoformat(),
        "scriptId": script_id,
        "scriptLabel": script_label,
        "kvm": context.get("kvm", {}),
        "message": "Reboot command accepted." if ok else "All reboot methods failed. See attempts for stderr and exit codes.",
        "attempts": attempts,
        "hint": "For LMDE/Linux Docker hosts, use privileged: true, pid: host, then recreate the container. If normal methods fail, set ALLOW_SYSRQ_FORCE=true for abrupt last-resort reboot.",
    }, indent=2))
    return int(last_exit_code)


if __name__ == "__main__":
    raise SystemExit(main())
