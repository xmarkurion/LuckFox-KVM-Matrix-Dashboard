#!/usr/bin/env python3
"""Force power off the host machine from the LuckFox Host Script Agent.

This script is intentionally guarded because it can immediately shut down the PC.
Set ALLOW_HOST_POWER_COMMANDS=true in the host-agent container environment before
using it. When the agent runs inside Docker on Linux, host shutdown usually also
requires the container to run with `privileged: true` and `pid: host`.

Optional override:
  POWER_OFF_COMMAND="/path/to/your-command arg1 arg2"
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


def bool_env(name: str) -> bool:
    return os.getenv(name, "").strip().lower() in {"1", "true", "yes", "on"}


def load_context() -> dict[str, Any]:
    try:
        return json.loads(sys.stdin.read() or "{}")
    except json.JSONDecodeError:
        return {}


def command_candidates() -> list[list[str]]:
    override = os.getenv("POWER_OFF_COMMAND", "").strip()
    if override:
        return [shlex.split(override)]

    system = platform.system().lower()
    if system == "windows":
        return [["shutdown", "/s", "/f", "/t", "0"]]

    candidates: list[list[str]] = []

    # Best Docker/Linux host option when the container has pid: host + enough privileges.
    if shutil.which("nsenter"):
        candidates.extend([
            ["nsenter", "--target", "1", "--mount", "--uts", "--ipc", "--net", "--pid", "systemctl", "poweroff", "--force", "--force"],
            ["nsenter", "--target", "1", "--mount", "--uts", "--ipc", "--net", "--pid", "shutdown", "-h", "now"],
            ["nsenter", "--target", "1", "--mount", "--uts", "--ipc", "--net", "--pid", "poweroff", "-f"],
        ])

    candidates.extend([
        ["systemctl", "poweroff", "--force", "--force"],
        ["shutdown", "-h", "now"],
        ["poweroff", "-f"],
    ])
    return candidates


def run_first_available(commands: list[list[str]]) -> tuple[list[str], int, str, str]:
    errors: list[str] = []
    for command in commands:
        binary = command[0]
        if shutil.which(binary) is None:
            errors.append(f"missing binary: {binary}")
            continue
        try:
            completed = subprocess.run(command, text=True, capture_output=True, timeout=10, check=False)
            return command, completed.returncode, completed.stdout, completed.stderr
        except subprocess.TimeoutExpired as exc:
            return command, 124, exc.stdout or "", f"Command timed out: {' '.join(command)}"
        except OSError as exc:
            errors.append(f"{' '.join(command)} -> {exc}")
    return [], 127, "", "; ".join(errors) or "No usable power-off command found"


def main() -> int:
    context = load_context()
    if not bool_env("ALLOW_HOST_POWER_COMMANDS"):
        print(json.dumps({
            "ok": False,
            "at": datetime.now(timezone.utc).isoformat(),
            "scriptId": context.get("script", {}).get("id") or os.getenv("HOST_SCRIPT_ID", "power_off_force"),
            "scriptLabel": context.get("script", {}).get("label") or os.getenv("HOST_SCRIPT_LABEL", "Force Power Off"),
            "message": "Blocked. Set ALLOW_HOST_POWER_COMMANDS=true in host-agent/docker-compose.yaml to enable host shutdown scripts.",
            "hint": "On Linux Docker hosts, you may also need privileged: true and pid: host for the host, not just the container, to shut down.",
        }, indent=2))
        return 2

    command, exit_code, stdout, stderr = run_first_available(command_candidates())
    print(json.dumps({
        "ok": exit_code == 0,
        "at": datetime.now(timezone.utc).isoformat(),
        "scriptId": context.get("script", {}).get("id") or os.getenv("HOST_SCRIPT_ID", "power_off_force"),
        "scriptLabel": context.get("script", {}).get("label") or os.getenv("HOST_SCRIPT_LABEL", "Force Power Off"),
        "kvm": context.get("kvm", {}),
        "command": command,
        "exitCode": exit_code,
        "stdout": stdout,
        "stderr": stderr,
    }, indent=2))
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
