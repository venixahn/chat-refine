# Setup

## Requirements

- Node.js 24+
- npm 11+
- Microsoft Edge on Windows for Playwright (`msedge`)

## Install

```bash
git clone https://github.com/venix523/chat-refine.git
cd chat-refine
git checkout develop
npm install
copy .env.example .env
```

On Unix, use `cp .env.example .env`. Set `SESSION_SECRET` before any real use.

## ICE

The same ICE list is used for the live-text mesh and for each caller’s SFU connection.

- Leave `ICE_SERVERS` blank for Google STUN (internet peers).
- `ICE_SERVERS=[]` for LAN-only host candidates.
- Hard NAT: run coturn, then point `ICE_SERVERS` at it.

This repo does not ship a TURN daemon. The path we run is [coturn](https://github.com/coturn/coturn) in Docker, then Nest reads that host from `ICE_SERVERS`. Use the LAN or public IP both browsers can reach — not `127.0.0.1`. Docker Desktop on Windows cannot use `--network=host`.

```bash
# Git Bash. Replace HOST_IP. UDP 3478 and 49160–49200 must be reachable.
HOST_IP=192.168.1.10

docker run --rm --name chat-refine-turn \
  -p 3478:3478 \
  -p 3478:3478/udp \
  -p 49160-49200:49160-49200/udp \
  coturn/coturn:4.6.3 \
  -n --log-file=stdout \
  --listening-port=3478 \
  --external-ip="$HOST_IP" \
  --realm=chat-refine \
  --user=chat:change-this-turn-secret \
  --fingerprint --no-cli \
  --min-port=49160 --max-port=49200
```

Then in `.env` (same IP and secret; restart `npm run dev`):

```bash
ICE_SERVERS=[{"urls":"stun:stun.l.google.com:19302"},{"urls":"turn:192.168.1.10:3478","username":"chat","credential":"change-this-turn-secret"}]
```

The thread keeps the status `Connecting peers…` (e2e matches that string). After about eight seconds with no data channel, a second line says the host should add a relay.

## Run

```bash
npm run dev
```

- Client: https://127.0.0.1:5173 (also on your LAN IP; accept the self-signed cert)
- API: http://127.0.0.1:3000/api/health

Vite serves HTTPS and proxies `/api` and `/ws` to Nest. Camera and mic need that HTTPS origin.

## Test

```bash
npm test          # Vitest + coverage
npm run test:e2e  # Playwright
npm run lint
```

Coverage must stay at **80%** lines/statements/functions and **70%** branches. Husky runs tests on commit and e2e on push. Playwright talks to Vite over HTTPS and ignores the self-signed certificate.
