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
- Add your own TURN for hard NAT.

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

Coverage must stay at **80%** lines/statements/functions and **70%** branches. Husky runs tests on commit and e2e on push.
