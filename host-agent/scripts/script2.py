#!/usr/bin/env python3
"""Example second script for the LuckFox Host Script Agent.

Rename this file or add more files in the same folder. The dashboard calls scripts by
id, where the id is the filename without `.py`, for example `script2`.
"""

from __future__ import annotations

import json
import os
import platform
import sys
from datetime import datetime, timezone


def main() -> int:
    context = json.loads(sys.stdin.read() or "{}")
    result = {
        "at": datetime.now(timezone.utc).isoformat(),
        "scriptId": context.get("script", {}).get("id") or os.getenv("HOST_SCRIPT_ID"),
        "scriptLabel": context.get("script", {}).get("label") or os.getenv("HOST_SCRIPT_LABEL"),
        "kvmId": context.get("kvm", {}).get("id") or os.getenv("KVM_ID"),
        "kvmName": context.get("kvm", {}).get("name") or os.getenv("KVM_NAME"),
        "hostname": platform.node(),
        "platform": platform.platform(),
        "message": "Example script2 executed successfully",
        "payload": context.get("payload", {}),
    }
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
