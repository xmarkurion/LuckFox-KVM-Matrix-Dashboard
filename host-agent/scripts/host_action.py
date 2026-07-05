#!/usr/bin/env python3
"""Editable script executed by the LuckFox Host Script Agent.

The agent passes context in two ways:
1. JSON on stdin: {"kvm": {...}, "payload": {...}}
2. Environment variables: KVM_ID, KVM_NAME, KVM_IP, KVM_PAYLOAD_JSON

Edit this file on the host and restart nothing; the mounted file is read each run.
"""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path


def main() -> int:
    raw = sys.stdin.read() or "{}"
    context = json.loads(raw)
    kvm = context.get("kvm", {})
    payload = context.get("payload", {})

    log_path = Path(os.getenv("SCRIPT_LOG_PATH", "/scripts/host_action.log"))
    line = {
        "at": datetime.now(timezone.utc).isoformat(),
        "kvmId": kvm.get("id") or os.getenv("KVM_ID"),
        "kvmName": kvm.get("name") or os.getenv("KVM_NAME"),
        "kvmIp": kvm.get("ip") or os.getenv("KVM_IP"),
        "payload": payload,
        "message": "Host script triggered from LuckFox KVM Matrix",
    }

    log_path.parent.mkdir(parents=True, exist_ok=True)
    with log_path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(line) + "\n")

    print(json.dumps(line, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
