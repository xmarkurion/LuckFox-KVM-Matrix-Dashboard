# LuckFox Host Script Agent

FastAPI service that runs on a target machine and gives the LuckFox KVM Matrix dashboard two optional features:

1. Run named Python scripts from a mounted `scripts/` directory.
2. Return host stats such as CPU, memory, disks, uptime, OS, Docker/cgroup visibility, network counters, temperatures, battery, and top processes when visible from Docker.

The dashboard calls this service only when a KVM entry has `hostAgent` configured.

---

## Run with Docker

```bash
docker compose up -d --build
```

The agent listens on:

```text
http://<target-machine-ip>:8799
```

Health check:

```bash
curl http://127.0.0.1:8799/health
```

Stats check:

```bash
curl -H "Authorization: Bearer change-me-agent-token" http://127.0.0.1:8799/stats
```

---

## Create the agent token

The token is a shared secret that you create yourself. It is not issued by LuckFox.

Generate one:

```bash
openssl rand -hex 32
```

Or with Python:

```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

Set it in `host-agent/docker-compose.yaml`:

```yaml
services:
  host-script-agent:
    environment:
      AGENT_TOKEN: "REPLACE_WITH_LONG_RANDOM_TOKEN"
```

Set the same value in the dashboard `kvm.config.json`:

```json
"hostAgent": {
  "enabled": true,
  "url": "http://192.168.10.92:8799",
  "token": "REPLACE_WITH_LONG_RANDOM_TOKEN",
  "timeoutMs": 60000,
  "scripts": [
    { "id": "host_action", "label": "Default Script" },
    { "id": "script2", "label": "Example Script 2" }
  ]
}
```

Test it:

```bash
curl -H "Authorization: Bearer REPLACE_WITH_LONG_RANDOM_TOKEN" http://127.0.0.1:8799/stats
```

A `401 Unauthorized` response means the Bearer token does not match `AGENT_TOKEN`.

---

## Multiple scripts

The agent runs scripts by id. The id maps to a Python file in the mounted `/scripts` directory:

```text
host_action -> /scripts/host_action.py
script2     -> /scripts/script2.py
backup      -> /scripts/backup.py
```

Add a new script by placing a file under:

```text
scripts/<id>.py
```

Then add the same id to the dashboard config under `hostAgent.scripts[]` with a readable label.

No rebuild is required after editing or adding scripts because the folder is mounted into the container.

List scripts visible to the agent:

```bash
curl -H "Authorization: Bearer change-me-agent-token" http://127.0.0.1:8799/scripts
```

Run a script manually:

```bash
curl -X POST http://127.0.0.1:8799/run \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer change-me-agent-token" \
  -d '{
    "scriptId":"script2",
    "scriptLabel":"Example Script 2",
    "kvm":{"id":"am4","name":"AM4","ip":"192.168.10.92"},
    "payload":{"source":"manual"}
  }'
```

---

## Script context

Each script receives JSON on stdin:

```json
{
  "script": { "id": "script2", "label": "Example Script 2", "path": "/scripts/script2.py" },
  "kvm": { "id": "am4", "name": "AM4", "ip": "192.168.10.92" },
  "payload": { "source": "manual" }
}
```

And environment variables:

```text
HOST_SCRIPT_ID
HOST_SCRIPT_LABEL
HOST_SCRIPT_PATH
KVM_ID
KVM_NAME
KVM_IP
KVM_NOTES
KVM_WEBSITE_URL
KVM_PAYLOAD_JSON
```

---

## Host stats

`GET /stats` uses `psutil` and cgroup/procfs files to report what the container can see.

The compose file includes read-only mounts for a better Linux host view:

```yaml
volumes:
  - /proc:/host/proc:ro
  - /:/host/root:ro
```

On Docker Desktop for Windows/macOS, stats may describe the Docker Linux VM rather than the physical host.

---

## Security

- Use a long random `AGENT_TOKEN`.
- Do not expose this service directly to the internet.
- Use firewall rules so only the dashboard host can call it.
- Avoid privileged mode unless a script truly needs it.
- Mount only the host directories your scripts require.
