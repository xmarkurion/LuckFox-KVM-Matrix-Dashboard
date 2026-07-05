# LuckFox KVM Matrix

A Matrix-themed Vue/TypeScript dashboard for controlling multiple LuckFox PicoKVM devices from one place.

The app shows one rounded card per KVM, checks whether each KVM responds, shows practical video/USB status, displays optional host-agent stats like CPU, memory, disk, uptime, OS, Docker/cgroup visibility, and sends common API actions such as power press, reset press, Arrow Up, keyboard shortcuts, mouse actions, virtual media actions, Wake-on-LAN, raw JSON-RPC, and optional host-side Python script execution through a FastAPI agent.

> **Security note:** This project is designed for a trusted LAN or VPN. It can send power, keyboard, mouse, and script execution commands. Do not expose the dashboard or host script agent directly to the public internet.

---

## Easiest way to run the dashboard: Docker

Docker is the recommended production path. It builds the Vue frontend, compiles the TypeScript Node proxy, and serves the app on port `8787`.

```bash
git clone https://github.com/YOUR_USERNAME/luckfox-kvm-matrix.git
cd luckfox-kvm-matrix
cp kvm.config.json kvm.config.local.json  # optional backup/edit copy
docker compose up -d --build
```

Open:

```text
http://localhost:8787
```

Useful Docker commands:

```bash
# Show logs
docker compose logs -f

# Rebuild cleanly
docker compose build --no-cache

# Restart after changing kvm.config.json
docker compose restart luckfox-kvm-matrix

# Stop everything
docker compose down

# Check dashboard backend health
docker exec luckfox-kvm-matrix wget -qO- http://127.0.0.1:8787/api/health
```

If Docker itself fails with a message like `dockerDesktopLinuxEngine`, start Docker Desktop first and make sure it is using Linux containers.

---

## Optional: run the FastAPI host script agent

The dashboard itself should not execute arbitrary Python on your machines. Instead, this repo includes a small FastAPI service called the **host script agent**. Install/run that agent on the machine where the Python script should execute. The same agent now also exposes host stats on `/stats`, so the dashboard can show CPU, memory, disk, uptime, OS, Docker/cgroup visibility, network counters, temperatures when available, and top processes under each PC card.

You can run one agent per target machine, or run one local agent for testing.

### Run the agent locally from the root compose file

This starts the dashboard plus a local script agent using the optional compose profile:

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

### Host-agent token: create and use it

The host-agent token is not something you retrieve from LuckFox. It is a shared secret that you create yourself. The dashboard sends it as a Bearer token, and the FastAPI agent accepts requests only when it matches `AGENT_TOKEN`.

Generate a strong token on the machine where you edit the config:

```bash
# Linux/macOS/Git Bash
openssl rand -hex 32
```

Or with Python, which also works on Windows:

```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

Or with PowerShell:

```powershell
[Convert]::ToHexString((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

Put the generated value in two places:

1. In the host agent environment as `AGENT_TOKEN`.
2. In the matching dashboard KVM entry as `hostScript.token`.

For example, if your generated token is `REPLACE_WITH_LONG_RANDOM_TOKEN`, set the agent side like this:

```yaml
# host-agent/docker-compose.yaml
services:
  luckfox-host-agent:
    environment:
      AGENT_TOKEN: "REPLACE_WITH_LONG_RANDOM_TOKEN"
```

Then set the dashboard side like this:

```json
// kvm.config.json
"hostScript": {
  "enabled": true,
  "url": "http://192.168.10.92:8799",
  "token": "REPLACE_WITH_LONG_RANDOM_TOKEN",
  "label": "Run AM4 Script",
  "timeoutMs": 60000
}
```

Restart the agent and dashboard after changing tokens:

```bash
# on the target host running the agent
cd host-agent
docker compose up -d

# on the dashboard host
docker compose restart luckfox-kvm-matrix
```

Test the token directly against the agent:

```bash
curl -H "Authorization: Bearer REPLACE_WITH_LONG_RANDOM_TOKEN" http://192.168.10.92:8799/stats
```

If this returns stats, the token is correct. If it returns `401 Unauthorized`, the value in `AGENT_TOKEN` and `kvm.config.json` does not match.


### Host stats visibility in Docker

By default, a container can only report what Docker exposes to it. The provided compose files mount these read-only paths so the host agent can report a better host view:

```yaml
volumes:
  - /proc:/host/proc:ro
  - /:/host/root:ro
```

Remove those mounts if you only want container-visible stats. On Docker Desktop for Windows/macOS, these stats may describe the Docker Linux VM rather than the physical Windows/macOS host. On Linux, they usually describe the actual host where the agent container runs.

### Run the agent standalone on a target machine

Copy only the `host-agent/` folder to the target machine, then run:

```bash
cd host-agent
docker compose up -d --build
```

The agent will listen on:

```text
http://<target-machine-ip>:8799
```

Manual stats test:

```bash
curl -H "Authorization: Bearer change-me-agent-token" http://127.0.0.1:8799/stats
```

Manual script test:

```bash
curl -X POST http://127.0.0.1:8799/run \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer change-me-agent-token" \
  -d '{"kvm":{"id":"am4","name":"AM4","ip":"192.168.10.92"},"payload":{"source":"manual"}}'
```

### Change the script without rebuilding

Edit this file on the host/target machine:

```text
host-agent/scripts/host_action.py
```

The file is mounted into the container and is executed fresh on every request. No rebuild is required after editing the script.

The script receives context through stdin and environment variables:

```text
stdin JSON:        {"kvm": {...}, "payload": {...}}
KVM_ID            KVM id from kvm.config.json
KVM_NAME          KVM display name
KVM_IP            KVM IP from config
KVM_NOTES         notes from config
KVM_WEBSITE_URL   original KVM website URL
KVM_PAYLOAD_JSON  JSON payload sent with the action
```

---

## Configure your KVMs

Edit:

```text
kvm.config.json
```

There are two different secrets in this project:

- `password` is the LuckFox web/local login password used with `POST /auth/login-local`. In your working curl test, this was the normal password field, not an API token.
- `hostScript.token` is the FastAPI host-agent Bearer token. You create this token yourself and set the same value as `AGENT_TOKEN` in the host-agent compose file.

Example entry:

```json
{
  "id": "am4",
  "name": "AM4",
  "ip": "192.168.10.92",
  "password": "pass",
  "notes": "AM4 workstation / test host",
  "hostMacAddress": "",
  "hostScript": {
    "enabled": true,
    "url": "http://192.168.10.92:8799",
    "token": "change-me-agent-token",
    "label": "Run AM4 Script",
    "timeoutMs": 60000
  }
}
```

Fields:

| Field | Meaning |
| --- | --- |
| `id` | Stable internal id used by the app. Use lowercase letters/numbers/dashes. |
| `name` | Display name shown on the card. |
| `ip` | LuckFox KVM IP address. |
| `password` | Password used with `POST /auth/login-local`. |
| `notes` | Free text shown on the card. |
| `protocol` | Optional, `http` by default. Use `https` only if your KVM supports it. |
| `hostMacAddress` | Optional MAC address for Wake-on-LAN. |
| `hostScript.enabled` | Enables or disables the host script button. |
| `hostScript.url` | FastAPI agent URL on the target/host machine. |
| `hostScript.token` | Shared token sent to the FastAPI agent. |
| `hostScript.label` | Button label shown on the KVM card. |
| `hostScript.timeoutMs` | Maximum time the dashboard waits for the agent response. |

> The `hostScript.url` is the address of the machine running the FastAPI agent, not necessarily the LuckFox KVM address. Change it if your target host OS has a different IP.

---

## What this app does

LuckFox KVM Matrix has three parts:

1. **Vue 3 + TypeScript frontend** — the Matrix-style dashboard.
2. **Node/Express + TypeScript backend proxy** — stores KVM passwords server-side, manages KVM login cookies, and proxies KVM API calls.
3. **FastAPI host script agent** — optional service that runs an editable Python script on a target/host machine.

The browser talks to the Node backend only. The Node backend talks to the KVMs and optional host script agents.

This design keeps KVM passwords out of the browser bundle, avoids browser CORS problems, keeps API sessions server-side, and lets you run host scripts only on machines where you explicitly deploy the FastAPI agent.

---

## Features

- Matrix-style dashboard theme.
- Rounded card layout for each configured KVM.
- Central JSON configuration.
- KVM responding/authenticated status.
- Practical host power indicator based on HDMI/video readiness.
- Video state, USB state, and keyboard LED state where available.
- Direct button to open the original KVM website.
- Power press action.
- Reset press action.
- Arrow Up shortcut to wake a screen or select a boot menu.
- Ctrl+Alt+Del shortcut.
- Custom key press and key combo.
- Type text using USB HID keyboard reports.
- Mouse move/click/wheel controls.
- Virtual media mount/unmount controls.
- Wake-on-LAN support when a MAC address is configured.
- USB wakeup action.
- Reboot KVM action.
- Raw JSON-RPC panel for firmware-specific methods.
- Host Python script button through FastAPI.
- Docker production build.
- Jest tests and TypeScript checks.

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
│       └── host_action.py
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

Renders one KVM card. It shows the KVM name, IP, notes, status lines, and main action buttons:

- Open KVM
- Refresh
- Power
- Arrow Up
- Run Host Script

The details section contains the larger API control panels.

### `src/components/KeyboardPanel.vue`

Sends keyboard actions through the backend:

- single key press
- key combo
- Ctrl+Alt+Del
- typed text

### `src/components/MousePanel.vue`

Sends mouse reports:

- absolute mouse position
- relative mouse movement
- clicks
- wheel events

### `src/components/VirtualMediaPanel.vue`

Calls virtual-media related KVM RPC methods:

- mount remote HTTP image
- mount stored image
- mount built-in image
- unmount image

### `src/components/RawRpcPanel.vue`

Lets you call a raw JSON-RPC method for firmware-specific or experimental LuckFox/PicoKVM methods.

### `src/services/kvmApi.ts`

Frontend API client. It calls the local Node backend routes under `/api`.

### `server/index.ts`

Node/Express backend. It:

- loads `kvm.config.json`
- exposes local API routes
- logs into each KVM through `/auth/login-local`
- stores KVM session cookies in memory
- calls `/api/rpc` on each KVM
- converts dashboard actions into JSON-RPC calls
- calls the optional FastAPI host script agent
- serves the built Vue app from `dist/` in production

### `host-agent/app/main.py`

FastAPI agent that runs on the machine where your Python script should execute. It exposes:

- `GET /health`
- `GET /stats`
- `POST /run`

It executes the mounted Python script with `subprocess.run()` and returns stdout, stderr, exit code, duration, and success status. The stats endpoint uses `psutil` plus cgroup/procfs reads to return everything the Docker container can see: CPU, memory, swap, disks, uptime, OS/kernel, network counters, Docker/cgroup limits, temperatures when available, battery when available, and top processes.

### `host-agent/scripts/host_action.py`

Your editable script. Change this file to do whatever host-side task you need.

---

## Local development

Requires Node.js `20.19+` or `22.12+`.

Install dependencies:

```bash
npm install
```

Run frontend and backend together:

```bash
npm run dev
```

Open:

```text
http://localhost:5173
```

During development:

- Vite serves the frontend on `5173`.
- The Node backend runs on `8787`.
- Vite proxies `/api/*` to the backend.

Run only the backend:

```bash
npm run server:dev
```

Run only the frontend:

```bash
npm run client
```

---

## Testing and type checking

Run Jest tests:

```bash
npm run test
```

Run tests in watch mode:

```bash
npm run test:watch
```

Run TypeScript checks:

```bash
npm run type-check
```

Build production without Docker:

```bash
npm run build
npm start
```

Production app then listens on:

```text
http://localhost:8787
```

---

## Backend API routes

Dashboard/backend health:

```http
GET /api/health
```

List configured KVMs without exposing passwords:

```http
GET /api/kvms
```

List known dashboard actions:

```http
GET /api/actions
```

Get all KVM statuses:

```http
GET /api/kvms/status
```

Get one KVM status, including embedded host-agent stats when configured:

```http
GET /api/kvms/:id/status
```

Get only host-agent stats for one KVM target:

```http
GET /api/kvms/:id/host-stats
```

Force login to one KVM:

```http
POST /api/kvms/:id/login
```

Run a dashboard action:

```http
POST /api/kvms/:id/action/:action
```

Examples:

```bash
curl -X POST http://localhost:8787/api/kvms/am4/action/power
curl -X POST http://localhost:8787/api/kvms/am4/action/arrowUp
curl -X POST http://localhost:8787/api/kvms/am4/action/hostScript
```

Run raw JSON-RPC:

```http
POST /api/kvms/:id/rpc
```

Example:

```bash
curl -X POST http://localhost:8787/api/kvms/am4/rpc \
  -H "Content-Type: application/json" \
  -d '{"method":"getVideoState","params":{}}'
```

---

## LuckFox/PicoKVM API flow

The backend uses the local login flow you confirmed working:

```http
POST http://<kvm-ip>/auth/login-local
Content-Type: application/json

{"password":"pass"}
```

Then it stores the returned session cookie and calls:

```http
POST http://<kvm-ip>/api/rpc
Content-Type: application/json
Cookie: <session-cookie>

{"jsonrpc":"2.0","id":1,"method":"triggerPower","params":{}}
```

`params` is always included, even when empty, because LuckFox/PicoKVM firmware behaves more reliably that way.

---

## FastAPI host script API

Health:

```http
GET /health
```

Stats:

```http
GET /stats
Authorization: Bearer <AGENT_TOKEN>
```

Stats response includes fields like:

```json
{
  "ok": true,
  "hostname": "am4-host",
  "cpu": { "percent": 12.5, "countLogical": 16, "loadAverage": [0.1, 0.2, 0.3] },
  "memory": { "totalBytes": 17179869184, "usedBytes": 8589934592, "percent": 50 },
  "disks": [{ "mountpoint": "/host/root", "usedBytes": 53687091200, "percent": 50 }],
  "docker": { "containerized": true, "hostProcMounted": true, "hostRootMounted": true }
}
```

Run script:

```http
POST /run
Authorization: Bearer <AGENT_TOKEN>
Content-Type: application/json

{
  "kvm": {
    "id": "am4",
    "name": "AM4",
    "ip": "192.168.10.92"
  },
  "payload": {}
}
```

Response:

```json
{
  "ok": true,
  "script": "/scripts/host_action.py",
  "exitCode": 0,
  "durationMs": 123,
  "stdout": "...",
  "stderr": ""
}
```

---

## Troubleshooting

### Docker says it cannot connect to `dockerDesktopLinuxEngine`

Docker Desktop is not running, or it is not using the Linux engine. Start Docker Desktop, wait until it says it is running, then retry:

```bash
docker version
docker compose up -d --build
```

### Dashboard loads but KVM actions fail with HTTP 502

Check the backend logs:

```bash
docker compose logs -f luckfox-kvm-matrix
```

Check that the container can reach your KVM LAN IPs. On Linux, you may need host networking:

```yaml
network_mode: host
```

### Login fails

Confirm the password works directly:

```bash
curl -i -c cookies.txt \
  -H "Content-Type: application/json" \
  -X POST "http://192.168.10.92/auth/login-local" \
  -d '{"password":"pass"}'
```

### Power action returns success but PC does not turn on

Check the LuckFox Ext board/GPIO wiring to the motherboard `PWR_SW` front-panel pins. The API can only trigger the switch if the physical wiring is correct.

### Host script button fails

Check the agent health from the dashboard machine:

```bash
curl http://<target-machine-ip>:8799/health
```

Check token match:

- `AGENT_TOKEN` in `host-agent/docker-compose.yaml`
- `hostScript.token` in `kvm.config.json`

Check agent logs:

```bash
docker compose logs -f host-script-agent
```

### Host script changes do not apply

Make sure you edited the mounted file:

```text
host-agent/scripts/host_action.py
```

The script is read fresh each run. No rebuild is needed, but if you changed environment variables, restart the agent:

```bash
docker compose restart host-script-agent
```

---

## Security recommendations

- Keep the dashboard and agents on a private LAN or VPN.
- Do not commit real KVM passwords or real agent tokens to a public repo.
- Change `change-me-agent-token` before real use.
- Use firewall rules so only your dashboard machine can call host agents.
- Avoid running the agent container as privileged unless your script truly requires host-level access.
- If your script needs access to host files, mount only the exact folders it needs.

---

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Run Vite frontend and Node backend together. |
| `npm run client` | Run only the Vite frontend. |
| `npm run server:dev` | Run only the Node backend in watch mode. |
| `npm run type-check` | Run Vue and backend TypeScript checks. |
| `npm run test` | Run Jest tests once. |
| `npm run test:watch` | Run Jest in watch mode. |
| `npm run build` | Compile backend and build Vue frontend. |
| `npm start` | Run the production backend and serve `dist/`. |

---

## License
GPL-3.0
