# chat-refine

On-premises peer-to-peer chat: 1:1 and small-group **text, audio, and video**. You sign up on *this* server. Live text and call media travel over **WebRTC** between browsers. NestJS does auth, rooms, signaling, and **persisted chat history** so inbox, unread, and other devices stay in sync. Call media never goes through Nest.

## Current status

Working today:

- Public signup / sign-in / sign-out (Passport Local + session cookie)
- Room directory, group create/join, and 1:1 DMs
- Authenticated signaling WebSocket (`GET /api/signal/ticket`, then `/ws`)
- Authenticated ICE list (`GET /api/ice`) — Google STUN by default, or `ICE_SERVERS`
- P2P text over WebRTC data channels, plus server-stored history (and local cache)
- Unread counts and last-message previews in the room list
- Small file / image sharing (about 1 MB; stored on this server)
- Desktop notifications when a peer messages you (opt-in)
- Edit display name and avatar
- Light markdown in messages (`**bold**`, `*italic*`, `` `code` ``, http(s) links), HTML-escaped first
- 1:1 and small-group audio/video on the same mesh (join/leave, mute, camera)
- Landing, auth pages, and `/app` / `/app/c/:id`
- Stacked mobile layout (rooms list, then thread with a Rooms back link)
- Unit, API, coverage, and Playwright auth, chat, call, inbox, and mobile e2e

A/V mesh cap is **6 peers** (`AV_MESH_CAP`). Text-only rooms can be larger. Peers across the internet use public Google STUN by default. Set `ICE_SERVERS=[]` for LAN-only host candidates, or add your own TURN for hard NAT.

## Stack

| Piece | Choice |
| --- | --- |
| Client | Vite, SolidJS, TypeScript, Tailwind |
| API | NestJS (on-prem, one Node process) |
| Data | lowdb JSON (`data/db.json`, gitignored) |
| Validation | Zod |
| Auth | Passport Local + `express-session` |
| Transport | WebRTC data-channel + media mesh; Nest stores history and signals SDP/ICE |
| FP / reactive | fp-ts (pure), Effect (IO), RxJS (streams), Solid signals (view) |
| Tests | Vitest, Supertest, Playwright, V8 coverage |
| Quality | ESLint, Husky (`pre-commit` tests, `pre-push` e2e) |

No OAuth. Default ICE uses Google’s public STUN (`stun.l.google.com` and stun1–4). Live chat and call media still go peer-to-peer. Message bodies and small files are also written to `data/db.json` so history, unread, and other devices stay in sync. Optional: your own TURN / coturn via `ICE_SERVERS`.

## Requirements

- Node.js 24+
- npm 11+
- Microsoft Edge on Windows for Playwright (config uses the `msedge` channel)

## Setup

```bash
git clone https://github.com/venix523/chat-refine.git
cd chat-refine
git checkout develop
npm install
copy .env.example .env
```

On Unix, use `cp .env.example .env`. Set `SESSION_SECRET` in `.env` before any real use. Leave `ICE_SERVERS` blank for Google STUN (internet). Use `ICE_SERVERS=[]` for LAN-only.

## Run

```bash
npm run dev
```

- Client: [http://127.0.0.1:5173](http://127.0.0.1:5173) (also on your LAN IP)
- API: [http://127.0.0.1:3000/api/health](http://127.0.0.1:3000/api/health)

Vite binds all interfaces and proxies `/api` and `/ws` to Nest. Create an account, then open `general` (or start a DM). Sending a message POSTs it for history, then fans it out over the data channel when a peer is connected. Call media never hits the API — only join/SDP/ICE do. Join a call from the conversation header. Click your name to edit display name or avatar. Use **Notify** if you want desktop alerts while another tab is focused.

Production shape (later): `npm run build`, then Nest serves `client/dist` plus `/api` from one process.

## Test and lint

```bash
npm test          # Vitest + V8 coverage (shared + server)
npm run test:e2e  # Playwright (auth, chat, call, inbox, mobile)
npm run lint      # ESLint
```

Coverage HTML is written to `coverage/` (gitignored). `npm test` fails if lines/statements/functions drop below **80%** or branches below **70%**.

Husky runs `npm test` on commit and `npm run test:e2e` on push. Do not use `--no-verify` unless asked.

## ICE and using the app over the internet

Signed-in clients load ICE servers from `GET /api/ice` and pass them into each `RTCPeerConnection`.

**Default (blank `ICE_SERVERS`):** Google’s public STUN (`stun.l.google.com:19302` and stun1–4). That is enough for most home/office NATs. Nest still only signals; media stays peer-to-peer.

**LAN-only:** `ICE_SERVERS=[]` — host candidates, no STUN.

**Hard NAT:** add a TURN server you run (for example [coturn](https://github.com/coturn/coturn)):

```bash
ICE_SERVERS=[{"urls":"stun:stun.l.google.com:19302"},{"urls":"turn:turn.example:3478","username":"chat","credential":"secret"}]
```

Keep TURN credentials on this machine.

Publishing the app is separate from ICE. Both browsers must reach this host for signup and `/ws`:

1. Run `npm run dev` (Vite and Nest listen on all interfaces).
2. Open the app as `http://<this-machine>:5173` on the LAN, or port-forward / tunnel 5173 (and 3000, or put both behind one reverse proxy).
3. Camera and microphone need HTTPS except on `localhost`. A tunnel such as Cloudflare Tunnel or ngrok gives you that. Text chat can work over plain HTTP.

If peers never leave “Connecting peers…”, STUN could not punch the NAT — add TURN.

## Git Flow

- `main` — production (release / hotfix only)
- `develop` — integration
- `feature/<name>` — work branched from `develop`, merged back to `develop`
- `release/*` / `hotfix/*` — stabilize or patch production

Atomic commits, concise conventional messages (`feat:`, `fix:`, `test:`, `refactor:`). Push the feature branch after each green commit. Update this README in the same change when behavior or setup changes.

## Layout

```
client/   Solid + Vite UI
server/   NestJS API and signaling WebSocket
shared/   Zod schemas and pure helpers
e2e/      Playwright
data/     local JSON database (file gitignored)
```

## License

Private / unpublished unless you add a license later.
