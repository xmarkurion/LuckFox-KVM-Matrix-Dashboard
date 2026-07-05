# LuckFox Host Script Agent

This FastAPI service runs on the machine where your Python script should execute.
The main LuckFox KVM Matrix dashboard calls this agent when you press the `Run ... Script` button, and it also reads host stats from the same agent for display under each PC card.

## Docker run

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

## Create the agent token

The token is a shared secret that you create yourself. It is not issued by LuckFox. The dashboard sends it as an HTTP Bearer token, and this FastAPI service compares it with the `AGENT_TOKEN` environment variable.

Generate one:

```bash
# Linux/macOS/Git Bash
openssl rand -hex 32
```

Or with Python:

```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

Or with PowerShell:

```powershell
[Convert]::ToHexString((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

Set it in `host-agent/docker-compose.yaml`:

```yaml
services:
  luckfox-host-agent:
    environment:
      AGENT_TOKEN: "REPLACE_WITH_LONG_RANDOM_TOKEN"
```

Set the same value in the dashboard `kvm.config.json` for the matching machine:

```json
"hostScript": {
  "enabled": true,
  "url": "http://192.168.10.92:8799",
  "token": "REPLACE_WITH_LONG_RANDOM_TOKEN",
  "label": "Run AM4 Script",
  "timeoutMs": 60000
}
```

Restart after changing it:

```bash
docker compose up -d
```

Test it:

```bash
curl -H "Authorization: Bearer REPLACE_WITH_LONG_RANDOM_TOKEN" http://127.0.0.1:8799/stats
```

A `401 Unauthorized` response means the Bearer token in the request does not match `AGENT_TOKEN`.

Run the script manually through the API:

```bash
curl -X POST http://127.0.0.1:8799/run \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer change-me-agent-token" \
  -d '{"kvm":{"id":"am4","name":"AM4","ip":"192.168.10.92"},"payload":{"source":"manual"}}'
```

## Host stats

The `/stats` endpoint uses `psutil` and cgroup/procfs files to return what the Docker container can read, including:

- CPU usage, core/thread count, frequency, and load average
- memory and swap usage
- disk usage for container root and host root when mounted
- uptime, boot time, OS/kernel, hostname, and architecture
- Docker/cgroup visibility and limits
- network counters
- temperatures and battery data when the host exposes them
- top processes visible to the container

The compose file includes read-only mounts for a better Linux host view:

```yaml
volumes:
  - /proc:/host/proc:ro
  - /:/host/root:ro
```

Remove those mounts if you only want container-visible stats. On Docker Desktop for Windows/macOS, the stats may describe the Docker Linux VM rather than the physical Windows/macOS host.

## Change the script

Edit:

```text
scripts/host_action.py
```

No rebuild is required. The file is mounted into the container and is executed fresh for every request.

## Security

Use a long random `AGENT_TOKEN` and match it in the dashboard `kvm.config.json` under `hostScript.token`.
Do not expose this agent directly to the internet.
