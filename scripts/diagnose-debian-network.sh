#!/usr/bin/env bash
set -u

PORT="${DASHBOARD_PORT:-8787}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.debian.yaml}"

section() { printf '\n\033[1;32m== %s ==\033[0m\n' "$1"; }
run() { printf '$ %s\n' "$*"; "$@" 2>&1 || true; }

section "System"
run uname -a
if command -v hostname >/dev/null 2>&1; then run hostname -I; fi
run ip -brief address
run ip route

section "Docker"
run docker version
run docker compose -f "$COMPOSE_FILE" ps
run docker inspect luckfox-kvm-matrix --format '{{json .NetworkSettings}}'

section "Listening sockets"
run ss -lntp
printf '\nExpected: a LISTEN entry on 0.0.0.0:%s, *:%s, or [::]:%s.\n' "$PORT" "$PORT" "$PORT"

section "Local HTTP checks"
run curl --max-time 5 -fsS "http://127.0.0.1:${PORT}/api/health"
for address in $(hostname -I 2>/dev/null); do
  case "$address" in
    *:*) continue ;;
  esac
  run curl --max-time 5 -fsS "http://${address}:${PORT}/api/health"
done

section "Firewall hints"
if command -v nft >/dev/null 2>&1; then
  run sh -c "nft list ruleset | grep -nE '(${PORT}|hook input|policy drop|policy reject)'"
fi
if command -v ufw >/dev/null 2>&1; then run ufw status verbose; fi

section "Suggested browser URLs"
for address in $(hostname -I 2>/dev/null); do
  case "$address" in
    *:*) continue ;;
  esac
  printf 'http://%s:%s\n' "$address" "$PORT"
done

cat <<'TXT'

Interpretation:
- Local curl fails: the container is not running or the server did not bind.
- 127.0.0.1 works but the host-IP curl fails: inspect host firewall/network policy.
- Both local checks work but another PC fails: check Debian nftables/UFW, VM bridge mode,
  router/VLAN isolation, and any cloud or hypervisor firewall.
TXT
