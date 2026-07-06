![alt text](./readme/two.png)

# LuckFox KVM Matrix
A Matrix-themed Vue/TypeScript dashboard for controlling LuckFox PicoKVM devices and/or host-agent-only machines from one place. 
What's inside: 
- Fully dockerized env no need of installing anything beside docker itself
- JSON controlled cards per device ```kvm.config.json```
- can show both the KVM IP and the PC/host-agent IP
- tracks separate online status for the KVM and PC host script every 15 seconds
- checks KVM/login/video/USB status when a KVM is enabled
- displays optional host-agent stats,
- link to the original KVM website,
- sends keyboard/mouse/power/virtual-media actions,
- can run named Python scripts on the target host through a small FastAPI agent.
- devices without a physical KVM can set `kvm.enabled: false` or simply `kvm: false`; their cards keep PC status/stats/scripts and hide the KVM controls.

> **Security note:** This dashboard can send power, keyboard, mouse, virtual media, Wake-on-LAN, host-side script execution, reboot, and force power-off commands. Run it only on a trusted LAN/VPN. Do not expose the dashboard or the host-agent service directly to the public internet.

---

## What this app does

LuckFox KVM Matrix has three parts:

1. **Vue 3 + TypeScript frontend** — Matrix dashboard and component UI.
2. **Node/Express + TypeScript backend proxy** — keeps KVM passwords server-side, manages KVM login cookies, calls KVM JSON-RPC when enabled, and calls host agents.
3. **FastAPI host agent** — optional per-machine service for Python scripts and host stats.

The browser talks only to the Node backend. The Node backend talks to enabled KVMs and configured host agents.

This avoids browser CORS problems, keeps KVM passwords out of the frontend bundle, and lets host scripts run only on machines where you explicitly deploy the agent.

---

## Features

- Matrix-style dashboard theme.
- Rounded card layout per KVM.
- Central JSON configuration.
- Separate KVM and PC online badges on every card.
- KVM IP when `kvm.enabled` is true, and clickable PC IP on every card with a host agent. The PC IP is derived from `hostAgent.url` without protocol or port.
- PC reachability ping through host-agent `/health` every 15 seconds by default.
- KVM responding/authenticated status.
- Practical host power indicator based on HDMI/video readiness.
- Video state, USB state, and keyboard LED state where available.
- Host-agent stats under each PC card.
- Top-right scripts dropdown per PC.
- Multiple named host scripts per PC.
- Direct button to open the original KVM website.
- Power press, reset press, USB wakeup, Wake-on-LAN.
- Arrow Up shortcut.
- Ctrl+Alt+Del, custom key press, key combo, and typed text.
- Mouse move/click/wheel controls.
- Virtual media mount/unmount controls.
- Reboot KVM action.
- Raw JSON-RPC panel for firmware-specific methods.
- Docker production build.
- Jest tests and TypeScript checks.

---


## Easiest way to run: Docker

Docker is the recommended production path. It builds the Vue frontend, compiles the TypeScript Node backend, and serves the whole dashboard on port `8787`.

```bash
git clone https://github.com/YOUR_USERNAME/luckfox-kvm-matrix.git
cd luckfox-kvm-matrix
nano kvm.config.json

docker compose up -d --build
```

Open:

```text
http://localhost:8787
```

Useful Docker commands:

```bash
# Logs
docker compose logs -f

# Clean rebuild
docker compose build --no-cache

# Restart after editing kvm.config.json
docker compose restart luckfox-kvm-matrix

# Stop
docker compose down

# Backend health
docker exec luckfox-kvm-matrix wget -qO- http://127.0.0.1:8787/api/health
```

Make sure you can type ```docker ps``` in your cmd and it's return's something. 
I found out once trying to debug my code that my docker engine was not running. 

---

# FastAPI host agent for scripts and stats.
A way to execute Scripts on HOST machine.

The dashboard itself does **not** execute Python on your machines. 
For host-side actions, run the included FastAPI **host agent** on the machine where the Python scripts should execute.
To do so clone the repository on host machine then enter folder host-agent and use ```docker compose up -d``` there. 
If you do wnat power off script to work as well you do need to modify docker-compose.yaml follow instruction in file. 

The host agent provides:
- `GET /health`
- `GET /stats`
- `GET /scripts`
- `POST /run`

The dashboard uses the same agent to show host stats under each card:
The dashboard derives the displayed **PC IP** from `hostAgent.url`. 
Every dashboard refresh, by default every `15s`, calls `<hostAgent.url>/health` to show a separate **PC online/offline** badge beside the KVM online badge.

- CPU usage, logical/physical cores, load average, frequency where visible
- memory and swap usage
- disk usage
- uptime and boot time
- hostname, OS, kernel, architecture
- Docker/cgroup visibility
- network counters
- temperatures and battery when the host exposes them
- top visible processes

### Run dashboard plus a local test agent
From the repo root:

```bash
docker compose --profile agent up -d --build
```

The local agent listens on:

```text
http://localhost:8799
```

Health check:

```bash
curl http://localhost:8799/health
```

Stats check:
```bash
curl -H "Authorization: Bearer change-me-agent-token" http://localhost:8799/stats
```

### Run the agent standalone on a target machine
Copy only the `host-agent/` folder to the target PC, then run:

```bash
cd host-agent
docker compose up -d --build
```

The agent will listen on:

```text
http://<target-machine-ip>:8799
```

---

## Host-agent token
The host-agent token **sould be canged** . It is a shared secret you generate yourself.

The same token must be set in two places:
1. `AGENT_TOKEN` in the host-agent Docker Compose file.
2. `hostAgent.token` in `kvm.config.json` for the matching PC.

### To enerate a token:
```bash
# Linux/macOS/Git Bash
openssl rand -hex 32
```
Or with Python, including on Windows:
```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```
Or PowerShell:
```powershell
[Convert]::ToHexString((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

Set it in `host-agent/docker-compose.yaml`:
```yaml
services:
  host-script-agent:
    environment:
      AGENT_TOKEN: "REPLACE_WITH_LONG_RANDOM_TOKEN"
```

Set the same value in `kvm.config.json`:
```json
"hostAgent": {
  "enabled": true,
  "url": "http://192.168.10.92:8799",
  "token": "REPLACE_WITH_YOUR_TOKEN",
  "timeoutMs": 60000,
  "scripts": [
    {
      "id": "host_action",
      "label": "AM4 Default Script",
      "description": "Main editable action script."
    },
    {
      "id": "script2",
      "label": "AM4 Example Script 2",
      "description": "Second example script. Rename this to something meaningful."
    },
    {
      "id": "power_off_safe",
      "label": "Safe Power Off AM4",
      "description": "Requests a normal OS shutdown through the host agent."
    },
    {
      "id": "power_off_force",
      "label": "Force Power Off AM4",
      "description": "Force powers off the host through the host agent."
    },
    {
      "id": "reboot_pc",
      "label": "Reboot AM4",
      "description": "Reboots the host through the host agent."
    }
  ]
}
```

Restart after changing tokens:
```bash
# on the target host running the agent
cd host-agent
docker compose up -d

# on the dashboard host
docker compose restart luckfox-kvm-matrix
```

Test the token:
```bash
curl -H "Authorization: Bearer REPLACE_WITH_LONG_RANDOM_TOKEN" http://192.168.10.92:8799/stats
```

A `401 Unauthorized` response means the Bearer token does not match `AGENT_TOKEN`.

---

## Multiple host scripts
Each device card has a top-right **Scripts** dropdown. Every entry in `hostAgent.scripts[]` appears there with its readable label and description. This works even when `kvm.enabled` is `false`, so you can use the dashboard for script-only hosts that do not have a LuckFox KVM attached.

The host agent runs scripts by `id`:

```text
script id: host_action      ->  host-agent/scripts/host_action.py
script id: script2          ->  host-agent/scripts/script2.py
script id: power_off_safe   ->  host-agent/scripts/power_off_safe.py
script id: power_off_force  ->  host-agent/scripts/power_off_force.py
script id: reboot_pc        ->  host-agent/scripts/reboot_pc.py
script id: backup           ->  host-agent/scripts/backup.py
```

To add another script:

1. Add a Python file in `host-agent/scripts/`, for example:

```text
host-agent/scripts/backup.py
```

2. Add a matching config entry under the target device:

```json
{
  "id": "backup",
  "label": "Run Backup",
  "description": "Starts the local backup workflow.",
  "timeoutMs": 120000
}
```

3. Restart only the dashboard after editing `kvm.config.json`:

```bash
docker compose restart luckfox-kvm-matrix
```

You do **not** need to rebuild or restart the host agent after editing or adding files under `host-agent/scripts/`, because the directory is mounted into the container.

Manual script test:

```bash
curl -X POST http://127.0.0.1:8799/run \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer change-me-agent-token" \
  -d '{
    "scriptId": "script2",
    "scriptLabel": "Example Script 2",
    "kvm": {"id":"am4","name":"AM4","ip":"192.168.10.92"},
    "payload": {"source":"manual"}
  }'
```

The scripts receive context through stdin and environment variables.

Stdin JSON:

```json
{
  "script": { "id": "script2", "label": "Example Script 2", "path": "/scripts/script2.py" },
  "kvm": { "id": "am4", "name": "AM4", "ip": "192.168.10.92" },
  "payload": { "source": "manual" }
}
```

Environment variables:

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

## Built-in safe power-off, force power-off, and reboot scripts

Version `1.3.6` includes three guarded host power scripts:

```text
host-agent/scripts/power_off_safe.py
host-agent/scripts/power_off_force.py
host-agent/scripts/reboot_pc.py
```

They are listed in the example `kvm.config.json`, so they appear in each card's **Scripts** dropdown as readable actions such as **Safe Power Off AM4**, **Force Power Off AM4**, and **Reboot AM4**.

These scripts are guarded by default. The agent refuses to run them until this environment variable is enabled on the target host:

```yaml
services:
  host-script-agent:
    environment:
      ALLOW_HOST_POWER_COMMANDS: "true"
```

For Linux hosts running the agent inside Docker, shutting down or rebooting the actual host usually also requires the agent container to run with host privileges. In `host-agent/docker-compose.yaml`, uncomment these lines only on trusted machines:

```yaml
services:
  host-script-agent:
    privileged: true
    pid: host
```

After changing compose, recreate the container. A simple restart may keep the old container settings:

```bash
cd host-agent
docker compose up -d --force-recreate --build
```

Verify the running container really has the setting:

```bash
docker exec luckfox-host-script-agent printenv ALLOW_HOST_POWER_COMMANDS
docker inspect luckfox-host-script-agent --format '{{.HostConfig.Privileged}} {{.HostConfig.PidMode}}'
```

Expected output:

```text
true
true host
```

Manual tests:

```bash
# Safe power off the host: normal OS shutdown, no force flags, no SysRq
curl -X POST http://127.0.0.1:8799/run \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer change-me-agent-token" \
  -d '{"scriptId":"power_off_safe","scriptLabel":"Safe Power Off"}'

# Reboot the host
curl -X POST http://127.0.0.1:8799/run \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer change-me-agent-token" \
  -d '{"scriptId":"reboot_pc","scriptLabel":"Reboot PC"}'

# Force power off the host: abrupt fallback if safe shutdown is not enough
curl -X POST http://127.0.0.1:8799/run \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer change-me-agent-token" \
  -d '{"scriptId":"power_off_force","scriptLabel":"Force Power Off"}'
```

The safe script requests normal OS shutdown only. The force and reboot scripts try multiple Linux methods instead of stopping after the first failure. Their JSON output contains an `attempts` list showing each command, exit code, stdout, and stderr.

You can override the exact commands without editing the scripts:

```yaml
environment:
  SAFE_POWER_OFF_COMMAND: "shutdown -P now"
  POWER_OFF_COMMAND: "shutdown -h now"
  REBOOT_COMMAND: "shutdown -r now"
```

If LMDE still refuses normal shutdown/reboot commands from Docker, there is an optional last-resort Linux SysRq fallback. This is abrupt, so only enable it on a trusted host where you accept immediate force power/reboot behavior:

```yaml
environment:
  ALLOW_SYSRQ_FORCE: "true"
```

On Docker Desktop for Windows/macOS, these scripts run inside the Linux container/VM view and usually cannot reboot or power off the physical host unless you replace them with a host-specific integration. For Windows hosts, use a native service, Task Scheduler, SSH, WinRM, or edit these scripts to call the mechanism you prefer.

---

## Host stats visibility in Docker

A container can normally only report what Docker exposes to it. The provided compose files include read-only mounts for a better Linux host view:

```yaml
volumes:
  - /proc:/host/proc:ro
  - /:/host/root:ro
```

On Linux, this usually reports the actual host. On Docker Desktop for Windows/macOS, it may describe the Docker Linux VM rather than the physical Windows/macOS host.

Remove those mounts if you only want container-visible stats.

---

## Configure devices

Edit:

```text
kvm.config.json
```

There are two different secrets:

- `kvm.password` is the LuckFox web/local password used with `POST /auth/login-local`.
- `hostAgent.token` is the FastAPI host-agent Bearer token you generate yourself.

The preferred config separates the physical KVM from the PC/host agent. This lets one dashboard card be either:

- **KVM + host agent** — full LuckFox controls plus scripts/stats.
- **Host-agent only** — no LuckFox KVM connected; the card shows PC online/stats/scripts and hides all KVM controls.

### Normal KVM + host-agent device

```json
{
  "id": "am4",
  "name": "AM4",
  "notes": "AM4 workstation / test host",
  "kvm": {
    "enabled": true,
    "ip": "192.168.10.92",
    "password": "pass",
    "protocol": "http",
    "hostMacAddress": ""
  },
  "hostAgent": {
    "enabled": true,
    "url": "http://192.168.10.92:8799",
    "token": "change-me-agent-token",
    "timeoutMs": 60000,
    "scripts": [
      {
        "id": "host_action",
        "label": "Run AM4 Script",
        "description": "Default editable host action script."
      },
      {
        "id": "script2",
        "label": "AM4 Example Script 2",
        "description": "Example second script. Rename this label to match the task."
      },
      {
        "id": "power_off_safe",
        "label": "Safe Power Off AM4",
        "description": "Runs the host-agent safe OS shutdown script on this PC."
      },
      {
        "id": "power_off_force",
        "label": "Force Power Off AM4",
        "description": "Runs the host-agent force power-off script on this PC."
      },
      {
        "id": "reboot_pc",
        "label": "Reboot AM4",
        "description": "Runs the host-agent reboot script on this PC."
      }
    ]
  }
}
```

### Host-agent-only device, no KVM attached

Use this when the PC has a FastAPI host agent but no LuckFox KVM. The dashboard will still display the card, PC online status, host stats, and Scripts dropdown, but it will hide KVM IP, KVM online status, Open KVM, Power, Arrow Up, raw RPC, keyboard/mouse, virtual media, and other KVM-only controls. You can use either `"kvm": { "enabled": false }` or the shorter `"kvm": false`.

```json
{
  "id": "scriptbox",
  "name": "ScriptBox",
  "notes": "Host-agent-only automation box",
  "kvm": {
    "enabled": false
  },
  "hostAgent": {
    "enabled": true,
    "url": "http://192.168.10.150:8799",
    "token": "change-me-agent-token",
    "timeoutMs": 60000,
    "scripts": [
      {
        "id": "host_action",
        "label": "Run ScriptBox Script",
        "description": "Default editable host action script."
      },
      {
        "id": "script2",
        "label": "ScriptBox Maintenance",
        "description": "Example second script for this host."
      },
      {
        "id": "power_off_safe",
        "label": "Safe Power Off ScriptBox",
        "description": "Runs the host-agent safe OS shutdown script on this PC."
      },
      {
        "id": "power_off_force",
        "label": "Force Power Off ScriptBox",
        "description": "Runs the host-agent force power-off script on this PC."
      },
      {
        "id": "reboot_pc",
        "label": "Reboot ScriptBox",
        "description": "Runs the host-agent reboot script on this PC."
      }
    ]
  }
}
```

Field reference:

| Field | Meaning |
| --- | --- |
| `id` | Stable internal id used by the app. Use lowercase letters/numbers/dashes. |
| `name` | Display name shown on the card. |
| `notes` | Free text shown on the card. |
| `kvm.enabled` | Set `true` for a physical LuckFox KVM. Set `false` for host-agent-only devices. You can also set `kvm` itself to `false`. |
| `kvm.ip` | LuckFox KVM IP address. Required only when `kvm.enabled` is true. |
| `kvm.password` | LuckFox local web password used with `/auth/login-local`. Required only when `kvm.enabled` is true. |
| `kvm.protocol` | Optional, `http` by default. Use `https` only if the KVM supports it. |
| `kvm.hostMacAddress` | Optional MAC address for Wake-on-LAN. |
| `hostAgent.enabled` | Enables/disables the host-agent integration. |
| `hostAgent.url` | FastAPI agent URL on the target host. The dashboard displays only the hostname/IP part as **PC IP**. Example: `http://192.168.10.92:8799` displays as `192.168.10.92` and pings `http://192.168.10.92:8799/health` every refresh cycle. It may be different from the LuckFox KVM IP. |
| `hostAgent.token` | Shared Bearer token sent to the FastAPI agent. |
| `hostAgent.timeoutMs` | Default timeout for script runs. |
| `hostAgent.scripts[].id` | Script id. Runs `/scripts/<id>.py` on the agent. |
| `hostAgent.scripts[].label` | Human-readable dropdown text shown on the dashboard. |
| `hostAgent.scripts[].description` | Optional helper text shown in the dropdown. |
| `hostAgent.scripts[].timeoutMs` | Optional per-script timeout override. |

Legacy configs using top-level `ip`, `password`, `protocol`, `hostMacAddress`, or single-script `hostScript` still work. New configs should prefer the nested `kvm` and `hostAgent.scripts[]` format.

---

## Project structure

```text
luckfox-kvm-matrix/
├── Dockerfile
├── docker-compose.yaml
├── kvm.config.json
├── package.json
├── tsconfig.json
├── tsconfig.server.json
├── vite.config.ts
├── jest.config.cjs
├── babel.config.cjs
├── server/
│   ├── index.ts
│   └── types.ts
├── src/
│   ├── App.vue
│   ├── main.ts
│   ├── styles.css
│   ├── components/
│   │   ├── ActionButton.vue
│   │   ├── HostScriptMenu.vue
│   │   ├── HostStatsPanel.vue
│   │   ├── KeyboardPanel.vue
│   │   ├── KvmCard.vue
│   │   ├── KvmGrid.vue
│   │   ├── MatrixBackground.vue
│   │   ├── MousePanel.vue
│   │   ├── RawRpcPanel.vue
│   │   ├── StatusBadge.vue
│   │   ├── ToastStack.vue
│   │   └── VirtualMediaPanel.vue
│   ├── services/
│   │   ├── formatters.ts
│   │   └── kvmApi.ts
│   └── types/
│       ├── kvm.ts
│       └── ui.ts
├── host-agent/
│   ├── Dockerfile
│   ├── docker-compose.yaml
│   ├── requirements.txt
│   ├── app/
│   │   └── main.py
│   └── scripts/
│       ├── host_action.py
│       ├── script2.py
│       ├── power_off_safe.py
│       ├── power_off_force.py
│       └── reboot_pc.py
└── __tests__/
    ├── KvmCard.test.ts
    ├── formatters.test.ts
    ├── kvmApi.test.ts
    ├── styleMock.cjs
    └── vueTransformer.cjs
```

---

## Main parts explained

### `src/components/KvmCard.vue`

Renders one device card. When `kvm.enabled` is true, it shows KVM IP, KVM status, and all KVM controls. When `kvm.enabled` is false, it hides KVM-only UI and keeps clickable PC IP, PC online status, host stats, Refresh, Open PC Agent, and the top-right `HostScriptMenu` dropdown.

### `src/components/HostScriptMenu.vue`

Renders the top-right Scripts dropdown for the configured `hostAgent.scripts[]` entries and emits the selected `scriptId`.

### `src/components/HostStatsPanel.vue`

Displays CPU, memory, disk, uptime, hostname, OS, Docker visibility, and extra host stats from the FastAPI agent.

### `src/components/KeyboardPanel.vue`

Sends keyboard actions through the backend: single key, combo, Ctrl+Alt+Del, typed text.

### `src/components/MousePanel.vue`

Sends absolute mouse, relative mouse, click, and wheel reports.

### `src/components/VirtualMediaPanel.vue`

Calls virtual-media KVM RPC methods for mounting/unmounting images.

### `src/components/RawRpcPanel.vue`

Lets you call custom JSON-RPC methods for firmware-specific or experimental LuckFox/PicoKVM methods.

### `src/services/kvmApi.ts`

Frontend API client for the local Node backend under `/api`.

### `server/index.ts`

Node/Express backend. It loads config, logs into each KVM, stores session cookies in memory, calls `/api/rpc`, maps dashboard actions to JSON-RPC, calls host-agent `/health`, `/run`, and `/stats`, and serves the built Vue app in production.

### `host-agent/app/main.py`

FastAPI agent. It verifies the Bearer token, lists scripts, runs selected scripts from `/scripts/<id>.py`, and returns host stats using `psutil`.

### `host-agent/scripts/host_action.py`

Default editable script.

### `host-agent/scripts/script2.py`

Example second script showing how multiple named scripts work.

### `host-agent/scripts/power_off_safe.py`

Guarded script for safe OS shutdown of the target host. It uses normal shutdown commands only, with no force flags and no SysRq fallback. Requires `ALLOW_HOST_POWER_COMMANDS=true` and, for most Linux Docker deployments, `privileged: true` plus `pid: host`.

### `host-agent/scripts/power_off_force.py`

Guarded script for force powering off the target host. This is the abrupt fallback when safe shutdown is not enough. Requires `ALLOW_HOST_POWER_COMMANDS=true` and, for most Linux Docker deployments, `privileged: true` plus `pid: host`.

### `host-agent/scripts/reboot_pc.py`

Guarded script for rebooting the target host. Requires `ALLOW_HOST_POWER_COMMANDS=true` and, for most Linux Docker deployments, `privileged: true` plus `pid: host`.

---

## Local development

Requires Node.js `20.19+` or `22.12+`.

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:5173
```

During development:

- Vite frontend: `5173`
- Node backend: `8787`
- Vite proxies `/api/*` to the backend

Run only backend:

```bash
npm run server:dev
```

Run only frontend:

```bash
npm run client
```

---

## Testing and type checking

Run Jest tests:

```bash
npm run test
```

Watch tests:

```bash
npm run test:watch
```

Run TypeScript checks:

```bash
npm run type-check
```

Production build without Docker:

```bash
npm run build
npm start
```

Production app listens on:

```text
http://localhost:8787
```

---

## Backend API quick reference

List configured KVMs:

```http
GET /api/kvms
```

All statuses, including KVM reachability, PC reachability, and host stats when configured:

```http
GET /api/kvms/status
```

One KVM status:

```http
GET /api/kvms/:id/status
```

Host-agent stats only:

```http
GET /api/kvms/:id/host-stats
```

PC/host-agent reachability only:

```http
GET /api/kvms/:id/pc-status
```


Run an action:

```http
POST /api/kvms/:id/action/:action
```

Examples:

```bash
curl -X POST http://localhost:8787/api/kvms/am4/action/power
curl -X POST http://localhost:8787/api/kvms/am4/action/arrowUp
curl -X POST http://localhost:8787/api/kvms/am4/action/hostScript \
  -H "Content-Type: application/json" \
  -d '{"scriptId":"script2"}'
```

Raw KVM JSON-RPC:

```bash
curl -X POST http://localhost:8787/api/kvms/am4/rpc \
  -H "Content-Type: application/json" \
  -d '{"method":"getVideoState","params":{}}'
```

---

## Troubleshooting

### Browser says HTTP 502

Check the Node backend and whether it can reach the KVM/agent IPs:

```bash
curl http://127.0.0.1:8787/api/health
curl http://127.0.0.1:8787/api/kvms
```

On Linux, Docker bridge networking may not reach your LAN the way you expect. You can try host networking in `docker-compose.yaml`:

```yaml
network_mode: host
```

When using host networking, remove/comment the `ports:` section.

### KVM login fails

The dashboard uses the same flow you tested manually:

```http
POST /auth/login-local
{"password":"..."}
```

Use the LuckFox web/local password, not the host-agent token.


### PC badge says offline

The PC badge checks the configured `hostAgent.url` by calling `/health` from the Node backend every refresh cycle. Check from the dashboard host:

```bash
curl http://192.168.10.92:8799/health
```

If that fails, the PC may be off, the host-agent container may not be running, the port may be blocked by a firewall, or `hostAgent.url` may point to the wrong IP/port.

### Host-agent returns 401

Make sure these match exactly:

- `AGENT_TOKEN` in the host-agent compose file
- `hostAgent.token` in `kvm.config.json`

### Host script missing

The agent maps `scriptId` to `/scripts/<scriptId>.py`. If the dashboard sends `scriptId: "backup"`, the target host must have:

```text
host-agent/scripts/backup.py
```

The script id may contain only letters, numbers, underscores, and dashes.

### Power action succeeds but PC does not turn on

The LuckFox KVM power-control pins or Ext board must be wired to the motherboard `PWR_SW` pins. Without that wiring, the API request can succeed but the PC will not physically power on.

---

## Security recommendations

- Keep `kvm.config.json` private because it contains KVM passwords and host-agent tokens.
- Use long random host-agent tokens.
- Run only on a private LAN or VPN.
- Use firewall rules so only your dashboard machine can call host agents.
- Avoid privileged containers unless a script truly needs it. The built-in reboot/power-off scripts are the main case where this may be needed.
- Mount only the host directories your scripts actually need.
- Do not commit real passwords or tokens to a public GitHub repo.

---

## License
GPL-3.0
