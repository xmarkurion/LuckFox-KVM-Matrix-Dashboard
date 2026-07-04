# LuckFox KVM Matrix

A Matrix-themed web dashboard for controlling multiple LuckFox PicoKVM devices from one place.

The app gives you a card for each KVM, shows whether the KVM responds, shows practical host/video/USB status, opens the original KVM web interface, and sends common actions such as power button, reset, keyboard keys, mouse events, virtual media calls, Wake-on-LAN, and raw JSON-RPC.

> **Important:** This app is intended for your private LAN or VPN. It stores KVM passwords in a local server-side config file and sends power/keyboard/mouse commands to your machines. Do not expose it directly to the public internet.

---

## Easiest way to run: Docker

Docker is the recommended production path. It builds the Vue frontend, compiles the TypeScript Node proxy, and runs everything in one container on port `8787`.

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/luckfox-kvm-matrix.git
cd luckfox-kvm-matrix
```

### 2. Edit your KVM config

Open `kvm.config.json` and set your KVM names, IPs, passwords, and notes.

Example:

```json
{
  "server": {
    "port": 8787,
    "requestTimeoutMs": 8000,
    "pollIntervalMs": 15000
  },
  "kvms": [
    {
      "id": "lmde",
      "name": "LMDE",
      "ip": "192.168.10.91",
      "password": "pass",
      "notes": "Linux Mint Debian Edition host",
      "hostMacAddress": ""
    },
    {
      "id": "am4",
      "name": "AM4",
      "ip": "192.168.10.92",
      "password": "pass",
      "notes": "AM4 workstation / test host",
      "hostMacAddress": ""
    },
    {
      "id": "nas",
      "name": "NAS",
      "ip": "192.168.10.93",
      "password": "pass",
      "notes": "Storage server",
      "hostMacAddress": ""
    },
    {
      "id": "pcmain",
      "name": "PCMAIN",
      "ip": "192.168.10.94",
      "password": "pass",
      "notes": "Main PC",
      "hostMacAddress": ""
    }
  ]
}
```

### 3. Build and start

```bash
docker compose up -d --build
```

### 4. Open the app

```text
http://localhost:8787
```

### Useful Docker commands

```bash
# Show logs
docker compose logs -f

# Rebuild cleanly
docker compose build --no-cache

# Restart after editing kvm.config.json
docker compose restart

# Stop and remove the container
docker compose down

# Check backend health
docker exec luckfox-kvm-matrix wget -qO- http://127.0.0.1:8787/api/health
```

### If the container cannot reach your KVM IPs

On some Linux hosts, Docker bridge networking may not be able to reach devices on your LAN. If the app loads but all KVM calls fail, edit `docker-compose.yaml`:

```yaml
services:
  luckfox-kvm-matrix:
    network_mode: host
```

Then remove or comment the `ports:` section, because host networking uses the host port directly.

> `network_mode: host` is mainly useful on Linux. Docker Desktop on Windows and macOS handles host networking differently, so prefer the default bridge setup there.

---

## What this app does

LuckFox KVM Matrix is a small two-part app:

1. A **Vue 3 + TypeScript frontend** that shows the Matrix-themed dashboard.
2. A **Node/Express + TypeScript backend proxy** that talks to each LuckFox KVM over your LAN.

The browser talks only to the local backend. The backend talks to the KVMs.

This design is intentional:

- KVM passwords stay out of the browser bundle.
- Browser CORS restrictions do not block KVM requests.
- Login cookies/sessions are managed server-side.
- The UI can call one clean local API instead of directly calling four KVM devices.

---

## Features

- Matrix-style dashboard theme.
- Rounded card layout for each configured KVM.
- Central JSON configuration for all KVMs.
- KVM reachability status.
- Authentication status.
- Video/HDMI status using KVM video state.
- USB status using KVM USB state.
- Keyboard LED status when available.
- Direct button to open each original KVM web page.
- Power button action.
- Reset button action.
- Arrow Up shortcut to wake a screen or boot menu.
- Ctrl+Alt+Del shortcut.
- Custom key press.
- Custom key combo.
- Type text.
- Mouse move/click/wheel panel.
- Virtual media mount/unmount panel.
- Wake-on-LAN support if `hostMacAddress` is configured.
- USB wakeup action.
- Reboot KVM device action.
- Raw JSON-RPC panel for firmware-specific or experimental methods.
- Jest tests for services and Vue components.
- Docker production build.

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
│   ├── env.d.ts
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
│   ├── config/
│   │   └── capabilities.ts
│   ├── services/
│   │   ├── formatters.ts
│   │   └── kvmApi.ts
│   └── types/
│       ├── kvm.ts
│       └── ui.ts
└── __tests__/
    ├── KvmCard.test.ts
    ├── formatters.test.ts
    ├── kvmApi.test.ts
    ├── styleMock.cjs
    └── vueTransformer.cjs
```

---

## Main parts explained

### `kvm.config.json`

This is the main file you edit for your own setup.

It contains:

- backend port
- request timeout
- frontend polling interval
- KVM list
- KVM ID
- KVM display name
- KVM IP address
- KVM password
- notes
- optional host MAC address for Wake-on-LAN

The `password` field is the same password that works with:

```http
POST /auth/login-local
```

Example login payload used by the backend:

```json
{
  "password": "pass"
}
```

### `server/index.ts`

This is the Node/Express backend.

It handles:

- loading `kvm.config.json`
- serving the built Vue app from `dist/`
- exposing local API routes under `/api`
- logging into each KVM with `/auth/login-local`
- storing KVM session cookies in memory
- retrying login if a session expires
- sending JSON-RPC calls to `/api/rpc`
- normalizing errors so the frontend gets useful messages

The backend is needed because direct browser-to-KVM calls can fail because of CORS, and because putting passwords in frontend code would be unsafe.

### `server/types.ts`

Shared backend TypeScript types for:

- KVM config
- server config
- JSON-RPC payloads
- action payloads
- status responses

### `src/main.ts`

Vue app entry point. It mounts `App.vue` into `index.html`.

### `src/App.vue`

Top-level frontend screen.

It handles:

- loading the KVM list
- polling status
- calling actions
- showing toast notifications
- passing data down into components

### `src/components/KvmGrid.vue`

Grid layout for all configured KVM cards.

### `src/components/KvmCard.vue`

Main card for one KVM.

It shows:

- name
- IP address
- notes
- online/offline status
- authentication status
- host/video state
- USB state
- last checked time
- latency
- buttons for common actions

### `src/components/ActionButton.vue`

Reusable button component used across the app.

It keeps action button styling and disabled/loading behavior consistent.

### `src/components/StatusBadge.vue`

Small status pill component used for online/auth/video/USB style indicators.

### `src/components/KeyboardPanel.vue`

Keyboard controls.

It supports actions such as:

- Arrow Up
- Ctrl+Alt+Del
- custom key press
- key combinations
- type text

### `src/components/MousePanel.vue`

Mouse controls.

It supports actions such as:

- move mouse
- click button
- scroll wheel

### `src/components/VirtualMediaPanel.vue`

Virtual media controls.

It gives the UI for mounting and unmounting media through the KVM JSON-RPC interface.

Exact behavior depends on the LuckFox/PicoKVM firmware version and how virtual media is configured on the KVM.

### `src/components/RawRpcPanel.vue`

Advanced raw JSON-RPC panel.

Use this when your KVM firmware has a method that is not yet represented by a dedicated UI button.

Example method:

```json
{
  "method": "triggerPower",
  "params": {}
}
```

### `src/components/MatrixBackground.vue`

Visual Matrix-style background effect.

### `src/components/ToastStack.vue`

Toast notification stack for success and error messages.

### `src/services/kvmApi.ts`

Frontend API client.

It talks to the local backend routes, not directly to the KVM devices.

### `src/services/formatters.ts`

Small formatting helpers for status labels, times, and display values.

### `src/types/kvm.ts`

Frontend KVM-related TypeScript interfaces.

### `src/types/ui.ts`

Frontend UI-related TypeScript interfaces.

### `src/config/capabilities.ts`

Central list of known UI capabilities/actions. This keeps action labels and metadata separate from the components.

### `src/styles.css`

Global Matrix-style theme, layout, cards, buttons, panels, and responsive behavior.

---

## Backend API

The Vue app calls these local backend routes.

### Health check

```http
GET /api/health
```

Returns basic backend health information.

### List KVMs

```http
GET /api/kvms
```

Returns configured KVMs without exposing passwords.

### Get all statuses

```http
GET /api/status
```

Checks all configured KVMs.

### Get one status

```http
GET /api/status/:id
```

Checks one KVM by config ID.

Example:

```bash
curl http://localhost:8787/api/status/am4
```

### Run action

```http
POST /api/kvms/:id/actions/:action
```

Example:

```bash
curl -X POST http://localhost:8787/api/kvms/am4/actions/power \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Raw JSON-RPC

```http
POST /api/kvms/:id/rpc
```

Example:

```bash
curl -X POST http://localhost:8787/api/kvms/am4/rpc \
  -H "Content-Type: application/json" \
  -d '{"method":"triggerPower","params":{}}'
```

---

## KVM JSON-RPC behavior

The backend logs into each LuckFox KVM like this:

```http
POST http://KVM_IP/auth/login-local
Content-Type: application/json

{
  "password": "pass"
}
```

Then it sends JSON-RPC calls like this:

```http
POST http://KVM_IP/api/rpc
Content-Type: application/json
Cookie: session cookie from login

{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "triggerPower",
  "params": {}
}
```

The app is built around the password-based local login flow because that is the flow confirmed to work with your KVMs.

---

## Config reference

### Server config

```json
"server": {
  "port": 8787,
  "requestTimeoutMs": 8000,
  "pollIntervalMs": 15000
}
```

| Field | Meaning |
| --- | --- |
| `port` | Port used by the Node backend. |
| `requestTimeoutMs` | Timeout for calls from backend to KVM devices. |
| `pollIntervalMs` | Suggested frontend status polling interval. |

### KVM config

```json
{
  "id": "am4",
  "name": "AM4",
  "ip": "192.168.10.92",
  "password": "pass",
  "notes": "AM4 workstation / test host",
  "hostMacAddress": ""
}
```

| Field | Meaning |
| --- | --- |
| `id` | Stable unique ID used in URLs and actions. Use lowercase letters, numbers, and dashes. |
| `name` | Display name shown in the UI. |
| `ip` | KVM IP address. Do not include `http://`. |
| `password` | Password for `/auth/login-local`. |
| `notes` | Human-friendly note shown on the card. |
| `hostMacAddress` | Optional MAC address for Wake-on-LAN. Leave empty if unused. |

---

## Local development

### Requirements

- Node.js `20.19.0` or newer
- npm
- Access to your LuckFox KVM LAN

### Install dependencies

```bash
npm install
```

### Start development mode

```bash
npm run dev
```

This starts both:

- Vite frontend dev server
- TypeScript Node backend in watch mode

Open:

```text
http://localhost:5173
```

In development, Vite proxies `/api` requests to the backend.

### Run only the frontend

```bash
npm run client
```

### Run only the backend

```bash
npm run server:dev
```

### Backend health check

```bash
curl http://localhost:8787/api/health
```

---

## Production without Docker

You can also run it directly with Node.

### Build

```bash
npm install
npm run type-check
npm run test
npm run build
```

### Start

```bash
npm start
```

Open:

```text
http://localhost:8787
```

The production backend serves both:

- the API proxy under `/api`
- the built Vue app from `dist/`

---

## Testing

### Run all tests

```bash
npm run test
```

### Run tests in watch mode

```bash
npm run test:watch
```

### Type-check frontend and backend

```bash
npm run type-check
```

### Build production bundle

```bash
npm run build
```

Recommended before pushing to GitHub:

```bash
npm run type-check
npm run test
npm run build
```

---

## Test files

### `__tests__/KvmCard.test.ts`

Tests the main KVM card component renders identity/status information and emits actions.

### `__tests__/kvmApi.test.ts`

Tests frontend API service behavior.

### `__tests__/formatters.test.ts`

Tests formatting helpers.

### `__tests__/vueTransformer.cjs`

Custom Jest transformer for Vue single-file components.

### `__tests__/styleMock.cjs`

Mocks CSS imports for Jest.

---

## Docker details

### Build image manually

```bash
docker build -t luckfox-kvm-matrix:latest .
```

### Run manually

```bash
docker run -d \
  --name luckfox-kvm-matrix \
  --restart unless-stopped \
  -p 8787:8787 \
  -v "$PWD/kvm.config.json:/app/kvm.config.json:ro" \
  luckfox-kvm-matrix:latest
```

### Compose build

```bash
docker compose build
```

### Compose start

```bash
docker compose up -d
```

### Compose full rebuild

```bash
docker compose build --no-cache
 docker compose up -d
```

### Docker health check

The Docker image includes a health check against:

```text
http://127.0.0.1:8787/api/health
```

Check health:

```bash
docker ps
```

---

## Common actions

The UI exposes common KVM controls including:

| UI action | Purpose |
| --- | --- |
| Open Website | Opens the original KVM web interface. |
| Refresh | Rechecks one KVM status. |
| Power | Sends a power-button press. |
| Reset | Sends a reset-button press. |
| Arrow Up | Sends keyboard Arrow Up, useful for waking displays or menus. |
| Ctrl+Alt+Del | Sends a common reboot/login shortcut. |
| Type Text | Sends text through keyboard emulation. |
| Key Combo | Sends a custom keyboard combination. |
| Mouse Move | Sends relative mouse movement. |
| Mouse Click | Sends mouse button action. |
| Mouse Wheel | Sends scroll wheel action. |
| Wake-on-LAN | Sends WOL if a MAC address is configured. |
| USB Wakeup | Attempts USB wakeup action. |
| Virtual Media | Mount/unmount media through supported KVM RPC methods. |
| Raw RPC | Sends a custom JSON-RPC method and params. |

---

## Troubleshooting

### Docker says `open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified`

Docker Desktop is not running or the Linux engine is not available.

Fix:

1. Open Docker Desktop.
2. Wait until it says Docker is running.
3. Use Linux containers.
4. Run:

```bash
docker version
```

You should see both `Client` and `Server` sections.

If needed:

```bash
wsl --shutdown
```

Then restart Docker Desktop.

### App opens but all KVMs are offline

Check that the host running the app can reach the KVMs:

```bash
ping 192.168.10.92
curl http://192.168.10.92
```

If running in Docker, also check from inside the container:

```bash
docker exec -it luckfox-kvm-matrix sh
wget -qO- http://192.168.10.92
```

If the host can reach the KVMs but the container cannot, try Linux host networking as described above.

### Request failed with HTTP 502

This usually means the frontend could not get a useful response from the backend, or the backend could not reach/login to the target KVM.

Check backend health:

```bash
curl http://localhost:8787/api/health
```

Check configured KVM list:

```bash
curl http://localhost:8787/api/kvms
```

Check one KVM status:

```bash
curl http://localhost:8787/api/status/am4
```

Check logs:

```bash
docker compose logs -f
```

### Login rejected by KVM

Make sure the `password` in `kvm.config.json` is the same password that works with this curl command:

```bash
curl -i -c cookies.txt \
  -H "Content-Type: application/json" \
  -X POST "http://192.168.10.92/auth/login-local" \
  -d '{"password":"pass"}'
```

Expected response:

```json
{
  "message": "Login successful"
}
```

### Power button works in API but PC does not turn on

The KVM API can only trigger the KVM-side power-control output. The target PC still needs proper power-control wiring.

Check:

- LuckFox KVM Ext board or GPIO wiring is installed.
- KVM power-control pins are connected to the motherboard `PWR_SW` front-panel pins.
- The motherboard has standby power.
- The KVM itself is powered.

### Host power status is not exact

The app uses video/HDMI readiness as the practical host-power signal. If HDMI has no signal, the host may be off, asleep, in BIOS display mode, or simply not outputting video.

For exact power LED status, your firmware and wiring would need to expose a readable power LED or GPIO state through API/RPC.

---

## Security notes

- Do not commit real passwords to a public repository.
- Prefer using a private repo if `kvm.config.json` contains real device details.
- Consider committing a `kvm.config.example.json` and keeping your real `kvm.config.json` local.
- Put this app behind a VPN such as WireGuard or Tailscale for remote access.
- Do not port-forward this app or the KVM web interfaces directly to the internet.
- Anyone who can access this dashboard may be able to power/reset/type into your machines.

---

## Suggested GitHub setup

For a public repository, use this pattern:

1. Copy your real config to a private local file:

```bash
cp kvm.config.json kvm.config.local.json
```

2. Create a safe example config:

```bash
cp kvm.config.json kvm.config.example.json
```

3. Remove real passwords/IPs from `kvm.config.example.json`.

4. Add local config files to `.gitignore`:

```gitignore
kvm.config.local.json
.env
```

This project currently reads `kvm.config.json` by default. In Docker, you can mount whichever config file you want:

```yaml
volumes:
  - ./kvm.config.local.json:/app/kvm.config.json:ro
```

---

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Starts frontend and backend in development mode. |
| `npm run client` | Starts only Vite frontend. |
| `npm run server:dev` | Starts only backend with TypeScript watch. |
| `npm run type-check` | Type-checks Vue frontend and Node backend. |
| `npm run test` | Runs Jest tests. |
| `npm run test:watch` | Runs Jest in watch mode. |
| `npm run build` | Builds backend and frontend for production. |
| `npm start` | Starts the compiled production backend. |

---

## License

Add your preferred license before publishing.

Common options:

- MIT
- Apache-2.0
- GPL-3.0

---

## Disclaimer

This project sends remote control commands to physical computers. Use it carefully. Verify power/reset wiring before relying on it, and keep the dashboard restricted to trusted networks and users.
