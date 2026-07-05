#!/usr/bin/env python3
"""Safely power off the host machine from the LuckFox Host Script Agent.

This requests a normal operating-system shutdown. It does not use forced
poweroff flags and it never uses SysRq. It is safer for filesystems and running
services than power_off_force.py, but it can fail if the OS blocks shutdown or
if the container is not allowed to talk to host systemd/init.

Set ALLOW_HOST_POWER_COMMANDS=true in the host-agent container environment before
using it. On Linux Docker hosts, also use `privileged: true` and `pid: host` so
commands target the host rather than only the container.

Optional override:
  SAFE_POWER_OFF_COMMAND="/path/to/your-command arg1 arg2"
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
    override = os.getenv("SAFE_POWER_OFF_COMMAND", "").strip()
    if override:
        return [shlex.split(override)]

    system = platform.system().lower()
    if system == "windows":
        # No /f here: this asks Windows for a normal shutdown.
        return [["shutdown", "/s", "/t", "0"]]

    candidates: list[list[str]] = []

    # Docker/Linux host options. With pid: host + privileged, these target host namespaces.
    if shutil.which("nsenter"):
        nsenter_prefix = ["nsenter", "--target", "1", "--mount", "--uts", "--ipc", "--net", "--pid", "--"]
        candidates.extend([
            [*nsenter_prefix, "systemctl", "poweroff"],
            [*nsenter_prefix, "shutdown", "-P", "now"],
            [*nsenter_prefix, "shutdown", "-h", "now"],
            [*nsenter_prefix, "poweroff"],
        ])

    # Direct options. These may target the host when the container uses pid: host
    # and has sufficient privileges; otherwise they may affect only the container or fail.
    candidates.extend([
        ["systemctl", "poweroff"],
        ["shutdown", "-P", "now"],
        ["shutdown", "-h", "now"],
        ["poweroff"],
    ])
    return candidates


def run_all_until_success(commands: list[list[str]]) -> tuple[bool, list[dict[str, Any]]]:
    attempts: list[dict[str, Any]] = []
    for command in commands:
        binary = command[0]
        if shutil.which(binary) is None:
            attempts.append({
                "command": command,
                "exitCode": 127,
                "stdout": "",
                "stderr": f"missing binary: {binary}",
            })
            continue
        try:
            completed = subprocess.run(command, text=True, capture_output=True, timeout=10, check=False)
            attempt = {
                "command": command,
                "exitCode": completed.returncode,
                "stdout": completed.stdout,
                "stderr": completed.stderr,
            }
            attempts.append(attempt)
            if completed.returncode in SUCCESS_CODES:
                return True, attempts
        except subprocess.TimeoutExpired as exc:
            attempts.append({
                "command": command,
                "exitCode": 124,
                "stdout": exc.stdout or "",
                "stderr": f"Command timed out: {' '.join(command)}",
            })
        except OSError as exc:
            attempts.append({
                "command": command,
                "exitCode": 126,
                "stdout": "",
                "stderr": str(exc),
            })
    return False, attempts


def main() -> int:
    context = load_context()
    script_id = context.get("script", {}).get("id") or os.getenv("HOST_SCRIPT_ID", "power_off_safe")
    script_label = context.get("script", {}).get("label") or os.getenv("HOST_SCRIPT_LABEL", "Safe Power Off")

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
    last_exit_code = 0 if ok else (attempts[-1]["exitCode"] if attempts else 127)
    print(json.dumps({
        "ok": ok,
        "at": datetime.now(timezone.utc).isoformat(),
        "scriptId": script_id,
        "scriptLabel": script_label,
        "kvm": context.get("kvm", {}),
        "message": "Safe power-off command accepted." if ok else "All safe power-off methods failed. See attempts for stderr and exit codes.",
        "attempts": attempts,
        "hint": "Safe shutdown uses normal OS shutdown commands only. If the OS refuses shutdown and you truly need an abrupt fallback, use power_off_force.py instead.",
    }, indent=2))
    return int(last_exit_code)


if __name__ == "__main__":
    raise SystemExit(main())
