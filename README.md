# LuckFox KVM Matrix

A self-hosted dashboard for managing LuckFox PicoKVM devices and the PCs behind them.

The dashboard combines three jobs that are usually spread across different tools:

- open the LuckFox web console and send KVM actions such as power, reset, keyboard, mouse and virtual media commands;
- check whether the KVM and the PC are reachable;
- read host telemetry and run named Python maintenance scripts through the optional FastAPI host agent.

The UI is designed for a desktop operations screen, but it also collapses cleanly onto phones and tablets. Credentials stay in the Node backend; the browser never receives KVM passwords or host-agent tokens.

## First run without Docker

Use Node.js 22 LTS for the most predictable local setup. The repository includes a public npm lockfile and pins every direct dependency, so installs do not depend on the environment where the archive was created.

```bash
npm ci
npm start
```

`npm start` now performs a clean production build before starting the server. When it is ready, open:

```text
http://localhost:8787
```

To start an already-built checkout without rebuilding it, use:

```bash
npm run start:built
```

If an older archive left a partial install or cached registry configuration, clean it once and reinstall:

**Windows PowerShell**

```powershell
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
npm cache clean --force
npm config set registry https://registry.npmjs.org/
npm ci
npm start
```

**Linux / macOS**

```bash
rm -rf node_modules
npm cache clean --force
npm config set registry https://registry.npmjs.org/
npm ci
npm start
```

Do not delete the included `package-lock.json`; Docker and local installs use it for reproducible dependency versions.

## Start here: Debian 13 with Docker

For a Debian server on your LAN, use the host-network Compose file. This avoids Docker bridge/NAT surprises and lets the container reach the same KVM and host-agent addresses as Debian itself.

```bash
git clone <your-repository-url>
cd luckfox-kvm-matrix

# Review the device addresses and credentials first.
nano kvm.config.json

docker compose -f docker-compose.debian.yaml up -d --build
```

Check that the service is healthy:

```bash
curl http://127.0.0.1:8787/api/health
hostname -I
```

Then open the dashboard from another computer:

```text
http://<debian-lan-ip>:8787
```

For example:

```text
http://192.168.10.50:8787
```

The Debian Compose file uses `network_mode: host`, so there is no Docker `ports:` mapping to inspect. The Node server still listens on `0.0.0.0:8787` and is exposed directly through the Debian host network.

### If another computer still cannot connect

Internet access from the Debian machine only proves outbound networking works. It does not prove that TCP port `8787` is reachable from the LAN.

Run the included diagnostic script:

```bash
./scripts/diagnose-debian-network.sh
```

The important checks are:

```bash
# The container should be running.
docker compose -f docker-compose.debian.yaml ps

# Node should be listening on every interface.
sudo ss -lntp | grep 8787

# Both requests should succeed on the Debian host.
curl http://127.0.0.1:8787/api/health
curl http://$(hostname -I | awk '{print $1}'):8787/api/health

# Useful server-side network information.
curl http://127.0.0.1:8787/api/network
```

Expected listener examples:

```text
0.0.0.0:8787
*:8787
[::]:8787
```

If local requests work but another computer cannot connect, check the layers outside the application:

- Debian `nftables`, UFW or another host firewall;
- a VM firewall in Proxmox, VMware, Hyper-V or the cloud provider;
- whether the VM network adapter is bridged to the LAN rather than isolated behind NAT;
- VLAN, Wi-Fi client isolation or router rules between the two machines.

Useful firewall inspection commands:

```bash
sudo nft list ruleset
sudo ufw status verbose        # only when UFW is installed
sudo firewall-cmd --list-all   # only when firewalld is installed
```

If UFW is the active firewall, allow the dashboard port with:

```bash
sudo ufw allow 8787/tcp
```

Do not expose port `8787` directly to the public internet. Put it behind a VPN, a trusted reverse proxy with authentication, or a private management VLAN.

## Cross-platform Docker deployment

The normal Compose file uses Docker bridge networking and publishes port `8787` on all host interfaces:

```bash
docker compose up -d --build
```

Open:

```text
http://<docker-host-ip>:8787
```

This is the better default for Docker Desktop on Windows or macOS. On Linux, the Debian host-network file is usually simpler when the dashboard must reach physical devices on the same LAN.

Common commands:

```bash
docker compose ps
docker compose logs -f dashboard
docker compose restart dashboard
docker compose down
```

Rebuild after source changes:

```bash
docker compose up -d --build --force-recreate
```

## What the dashboard shows

Each device card can represent either:

1. a LuckFox KVM plus a PC host agent; or
2. a host-agent-only machine with no KVM attached.

A full device card includes:

- independent **KVM online** and **PC online** indicators;
- KVM IP and PC IP;
- direct links to the LuckFox web UI and the host-agent health endpoint;
- video state, approximate host power state, USB state and request latency;
- CPU, memory, disk and uptime telemetry from the host agent;
- a menu of named Python scripts;
- quick power, wake-screen and refresh actions;
- advanced keyboard, mouse, virtual media, Wake-on-LAN and raw JSON-RPC controls.

The dashboard refreshes status every 15 seconds by default. The interval is configured in `kvm.config.json`.

The top bar adds an overview of device health, search by name/IP/note, and filters for online, offline and agent-only machines.

## Architecture

```text
Browser
  │
  │ HTTP :8787
  ▼
Vue 3 dashboard + Node/Express API
  ├── LuckFox KVM /auth/login-local
  ├── LuckFox KVM /api/rpc
  └── FastAPI host agent :8799
        ├── /health
        ├── /stats
        ├── /scripts
        └── /run
```

### Frontend

The Vue application lives under `src/`.

- `src/App.vue` manages polling, filtering, toasts and actions.
- `src/components/DashboardHeader.vue` renders global health totals.
- `src/components/DashboardToolbar.vue` handles search and status filters.
- `src/components/KvmCard.vue` renders one device and its quick actions.
- `src/components/HostStatsPanel.vue` renders host telemetry.
- `src/components/HostScriptMenu.vue` renders the named-script menu.
- keyboard, mouse, virtual-media and raw-RPC controls are separate components.
- `src/services/kvmApi.ts` is the typed browser API client.
- `src/types/` contains shared frontend interfaces.

### Dashboard backend

The TypeScript server lives in `server/`.

It serves the production Vue bundle, reads `kvm.config.json`, keeps LuckFox login cookies in memory and proxies all KVM/agent calls. This is important because it prevents passwords and bearer tokens from being included in the frontend bundle.

Useful endpoints:

```text
GET  /api/health
GET  /api/network
GET  /api/kvms
GET  /api/kvms/status
GET  /api/kvms/:id/status
GET  /api/kvms/:id/pc-status
GET  /api/kvms/:id/host-stats
POST /api/kvms/:id/action/:action
POST /api/kvms/:id/rpc
```

### Host agent

`host-agent/` is a small FastAPI service installed on any PC where you want telemetry or script execution.

It exposes:

```text
GET  /health     unauthenticated reachability check
GET  /stats      authenticated host telemetry
GET  /scripts    authenticated list of available scripts
POST /run        authenticated script execution
```

The script directory is bind-mounted into the container, so a `.py` file can be edited or added without rebuilding the agent image.

## Configure devices

All devices are defined in `kvm.config.json`.

### KVM and host agent

```json
{
  "id": "am4",
  "name": "AM4",
  "notes": "AM4 workstation",
  "kvm": {
    "enabled": true,
    "ip": "192.168.10.92",
    "password": "replace-this-password",
    "protocol": "http",
    "hostMacAddress": ""
  },
  "hostAgent": {
    "enabled": true,
    "url": "http://192.168.10.92:8799",
    "token": "replace-with-agent-token",
    "timeoutMs": 60000,
    "scripts": [
      {
        "id": "host_action",
        "label": "Run maintenance task",
        "description": "Runs the default host action."
      },
      {
        "id": "power_off_safe",
        "label": "Safe power off",
        "description": "Requests a normal operating-system shutdown."
      },
      {
        "id": "reboot_pc",
        "label": "Reboot PC",
        "description": "Requests a host reboot."
      }
    ]
  }
}
```

The dashboard displays only the hostname/IP extracted from `hostAgent.url`. It still uses the full URL and port for API calls and opens `<hostAgent.url>/health` from the Agent health button.

### Host agent without a KVM

```json
{
  "id": "scriptbox",
  "name": "ScriptBox",
  "notes": "Automation host without a physical KVM",
  "kvm": {
    "enabled": false
  },
  "hostAgent": {
    "enabled": true,
    "url": "http://192.168.10.150:8799",
    "token": "replace-with-agent-token",
    "scripts": [
      {
        "id": "host_action",
        "label": "Run ScriptBox maintenance"
      }
    ]
  }
}
```

When KVM is disabled, the card keeps PC status, telemetry and scripts but does not render LuckFox controls.

### Server settings

```json
{
  "server": {
    "host": "0.0.0.0",
    "port": 8787,
    "requestTimeoutMs": 8000,
    "pollIntervalMs": 15000
  }
}
```

Keep `host` set to `0.0.0.0` for LAN access.

After changing `kvm.config.json`, restart the dashboard container:

```bash
docker compose -f docker-compose.debian.yaml restart dashboard
```

## Install the host agent

Copy the `host-agent/` directory to the target PC and create a token:

```bash
cd host-agent
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

Put that value in `host-agent/docker-compose.yaml`:

```yaml
environment:
  AGENT_TOKEN: "your-long-random-token"
```

Use the same value in the corresponding `hostAgent.token` entry in the dashboard config.

Start the agent:

```bash
docker compose up -d --build
```

Test it locally on the target PC:

```bash
curl http://127.0.0.1:8799/health
curl -H "Authorization: Bearer your-long-random-token" http://127.0.0.1:8799/stats
```

Test it from the dashboard server:

```bash
curl http://192.168.10.92:8799/health
curl -H "Authorization: Bearer your-long-random-token" http://192.168.10.92:8799/stats
```

If the first pair works but the second pair fails, the problem is the target PC firewall or network path, not the dashboard.

See [`host-agent/README.md`](host-agent/README.md) for script input, telemetry details and power-control setup.

## Add or edit host scripts

Scripts live in:

```text
host-agent/scripts/
```

The script ID is the filename without `.py`:

```text
backup.py           -> backup
power_off_safe.py   -> power_off_safe
reboot_pc.py        -> reboot_pc
```

Add the same ID to `hostAgent.scripts[]` in `kvm.config.json` and choose a readable label for the menu.

Example:

```json
{
  "id": "backup",
  "label": "Run nightly backup",
  "description": "Starts the workstation backup job.",
  "timeoutMs": 300000
}
```

Because the scripts directory is mounted into the agent container, editing a script does not require an image rebuild.

## Safe shutdown, forced shutdown and reboot

The repository includes:

```text
power_off_safe.py
power_off_force.py
reboot_pc.py
```

They are disabled until the agent receives:

```yaml
environment:
  ALLOW_HOST_POWER_COMMANDS: "true"
```

On Linux, host-level power commands generally also require:

```yaml
privileged: true
pid: host
```

Recreate the agent after changing those options:

```bash
docker compose up -d --build --force-recreate
```

Use safe shutdown first. The force script is intended for a machine that is no longer responding to a normal shutdown request.

## Local development

Requirements:

- Node.js 20.19 or newer;
- npm;
- access from the development machine to the KVM and host-agent networks.

Install dependencies:

```bash
npm ci
```

Run the Vue dev server and TypeScript backend together:

```bash
npm run dev
```

Open locally:

```text
http://localhost:5173
```

Open from another LAN computer:

```text
http://<development-machine-ip>:5173
```

The Vite server listens on `0.0.0.0` and proxies `/api` to the backend on port `8787`.

## Tests and production build

Run all checks:

```bash
npm run type-check
npm run test
npm run build
```

The repository currently includes Jest tests for:

- KVM cards, including agent-only devices and emitted actions;
- frontend API requests and error handling;
- formatting helpers.

Watch tests while developing:

```bash
npm run test:watch
```

Run the production application without Docker:

```bash
npm start
```

This cleans and rebuilds both `dist/` and `dist-server/`, then starts the compiled Node server. To run an existing build without rebuilding:

```bash
npm run start:built
```

The production server listens on `0.0.0.0:8787` unless overridden by `HOST` and `PORT`.

## Project layout

```text
.
├── Dockerfile
├── docker-compose.yaml
├── docker-compose.debian.yaml
├── kvm.config.json
├── package.json
├── server/
│   ├── index.ts
│   └── types.ts
├── src/
│   ├── components/
│   ├── services/
│   ├── types/
│   ├── App.vue
│   └── styles.css
├── host-agent/
│   ├── app/main.py
│   ├── scripts/
│   ├── Dockerfile
│   └── docker-compose.yaml
├── scripts/
│   └── diagnose-debian-network.sh
└── __tests__/
```

## Troubleshooting

### `Cannot find module dist-server/index.js`

That message means an older checkout tried to start the production server before compiling it. In this release, `npm start` builds automatically. Run:

```bash
npm ci
npm start
```

The compiled backend should then exist at `dist-server/index.js`.

### npm tries to download from an internal or unavailable registry

The fixed `package-lock.json` uses `https://registry.npmjs.org/`. If npm still reports another registry, clear the partial install and reset the registry:

```bash
npm config set registry https://registry.npmjs.org/
npm cache clean --force
npm ci
```

### Dashboard container is healthy, but the browser times out

Use the Debian host-network Compose file and run:

```bash
./scripts/diagnose-debian-network.sh
```

If `curl http://<debian-ip>:8787/api/health` works on Debian but not from another PC, inspect firewalls, VM network mode and VLAN/router rules.

### Dashboard opens, but KVM status is offline

Test from the dashboard host:

```bash
curl -i http://192.168.10.92/auth/login-local
```

Also confirm the Docker container can route to the KVM subnet. Host networking on Debian removes the most common bridge-routing difference.

### PC status is offline

The PC badge checks the host-agent health endpoint:

```bash
curl http://192.168.10.92:8799/health
```

The health endpoint does not require the token. Stats and script execution do.

### HTTP 401 from the host agent

`hostAgent.token` in `kvm.config.json` must exactly match `AGENT_TOKEN` on the target agent.

### Power script returns a non-zero exit code

Inspect the returned `attempts` output. Confirm the agent container was recreated with `ALLOW_HOST_POWER_COMMANDS=true`, `privileged: true` and `pid: host`. Start with `power_off_safe`; use the force path only when necessary.

## Security notes

This project controls physical machines. Treat the dashboard and host-agent token as administrative access.

- keep the dashboard on a trusted LAN or VPN;
- do not commit real passwords or tokens to a public repository;
- use a long random token for every host agent;
- use firewall rules to limit port `8799` to the dashboard server;
- enable privileged host power commands only on machines where they are required;
- prefer a reverse proxy with authentication if the dashboard must be exposed beyond the management network.

## License

Add the license that matches how you plan to distribute the project. No license is included by default.
