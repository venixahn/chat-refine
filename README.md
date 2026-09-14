# chat-refine

On-premises peer-to-peer chat: 1:1 and group **text, audio, and video**. You sign up on *this* server. Live text travels over **WebRTC** between browsers. Call media goes to Nest’s SFU once per caller and is forwarded to the others. Nest also does auth, rooms, signaling, and **persisted chat history**.

## Current status

Working today:

- Public signup / sign-in / sign-out (Passport Local + session cookie)
- Room directory, group create/join, and 1:1 DMs
- Authenticated signaling WebSocket (`GET /api/signal/ticket`, then `/ws`)
- Authenticated ICE list (`GET /api/ice`) — Google STUN by default, or `ICE_SERVERS`
- P2P text over WebRTC data channels, plus server-stored history (and local cache). An open thread also refetches history on activity so room text still appears if the mesh is down.
- Unread counts and last-message previews in the room list
- Attachments: files or a folder from one Attach control (any type/size; stored on disk, not in `db.json`)
- Desktop notifications when a peer messages you (opt-in)
- Profile: display name, bio, status, catalog or uploaded avatar, theme, search visibility
- Light markdown in messages (`**bold**`, `*italic*`, `` `code` ``, http(s) links), HTML-escaped first
- 1:1 and group audio/video via a Nest SFU (join/leave, mute, camera; one upload per caller). Remote tiles mute the video element and play audio separately so both callers’ feeds autoplay. Dev is HTTPS — accept the cert, then Join call.
- Landing, auth pages, and `/app` / `/app/c/:id`
- Stacked mobile layout (rooms list, then thread with a Rooms back link)
- Unit, API, coverage, and Playwright auth, chat, call, inbox, and mobile e2e

A/V cap is **16 peers** (`AV_MESH_CAP`). Each caller sends media to Nest; Nest forwards it (SFU). Text-only rooms can be larger. Peers across the internet use public Google STUN by default. Set `ICE_SERVERS=[]` for LAN-only host candidates, or add your own TURN for hard NAT.

## Stack

| Piece | Choice |
| --- | --- |
| Client | Vite, SolidJS, TypeScript, Tailwind |
| API | NestJS (on-prem, one Node process) |
| Data | lowdb JSON (`data/db.json`, gitignored) |
| Validation | Zod |
| Auth | Passport Local + `express-session` |
| Transport | WebRTC data-channel mesh for live text; Nest SFU for call media; Nest stores history and signals SDP/ICE |
| FP / reactive | fp-ts (pure), Effect (IO), RxJS (streams), Solid signals (view) |
| Tests | Vitest, Supertest, Playwright, V8 coverage |
| Quality | ESLint, Husky (`pre-commit` tests, `pre-push` e2e) |

No OAuth. Default ICE uses Google’s public STUN (`stun.l.google.com` and stun1–4). Live text stays on a WebRTC data-channel mesh. Call audio and video go through Nest’s SFU. Message bodies live in `data/db.json`; file and folder bytes go to `data/files/`. Optional: your own TURN / coturn via `ICE_SERVERS`.

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

- Client: [https://127.0.0.1:5173](https://127.0.0.1:5173) (also on your LAN IP over HTTPS)
- API: [http://127.0.0.1:3000/api/health](http://127.0.0.1:3000/api/health)

Vite binds all interfaces, serves HTTPS, and proxies `/api` and `/ws` to Nest. Accept the self-signed certificate once. Create an account, then open `general` (or start a DM). Sending a message POSTs it for history, then fans it out over the data channel when a peer is connected. An open thread also refetches history when activity arrives. Folder attach packs the directory into a zip. Your messages sit on the right; others on the left. Join call works on that HTTPS origin, including a LAN hostname. Click your name to edit bio, status, theme, visibility, or pick one of 36 avatars (or upload your own). Use **Notify** if you want desktop alerts while another tab is focused.

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

**Default (blank `ICE_SERVERS`):** Google’s public STUN (`stun.l.google.com:19302` and stun1–4). That is enough for most home/office NATs. The same ICE list is used for the text mesh and for each caller’s SFU connection. Nest signals both; call media is forwarded by the SFU, live text is not.

**LAN-only:** `ICE_SERVERS=[]` — host candidates, no STUN.

**Hard NAT:** add a TURN server you run (for example [coturn](https://github.com/coturn/coturn)):

```bash
ICE_SERVERS=[{"urls":"stun:stun.l.google.com:19302"},{"urls":"turn:turn.example:3478","username":"chat","credential":"secret"}]
```

Keep TURN credentials on this machine.

Publishing the app is separate from ICE. Both browsers must reach this host for signup and `/ws`:

1. Run `npm run dev` (Vite and Nest listen on all interfaces; Vite is HTTPS).
2. Open the app as `https://<this-machine>:5173` on the LAN (accept the cert), or port-forward / tunnel 5173 (and 3000, or put both behind one reverse proxy).
3. Camera and microphone work on that Vite HTTPS origin. A public tunnel such as Cloudflare Tunnel or ngrok is still useful if you want a trusted certificate.

If peers never leave “Connecting peers…”, STUN could not punch the NAT — add TURN.

## Git Flow

- `main` — production (release / hotfix only)
- `develop` — integration
- `feature/<name>` — work branched from `develop`, merged back to `develop`
- `release/*` / `hotfix/*` — stabilize or patch production

Atomic commits, concise conventional messages (`feat:`, `fix:`, `test:`, `refactor:`). Push the feature branch after each green commit. Update this README and `docs/` in the same change when behavior, setup, or status changes.

## Wiki

- In-repo docs: [`docs/Home.md`](docs/Home.md)
- Architecture (system diagram): [`docs/Architecture.md`](docs/Architecture.md)
- Project status: [`docs/Project-status.md`](docs/Project-status.md)
- GitHub Project: [chat-refine wiki](https://github.com/users/venix523/projects/1)

GitHub Wiki pages are not available on a private free-plan repo, so the wiki lives in `docs/` and on that project.

## Layout

```
client/   Solid + Vite UI
server/   NestJS API and signaling WebSocket
shared/   Zod schemas and pure helpers
e2e/      Playwright
docs/     project wiki
data/     local JSON database (file gitignored)
```

## License

Private / unpublished unless you add a license later.
