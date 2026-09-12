# chat-refine

On-premises peer-to-peer chat: 1:1 and small-group **text, audio, and video**. You sign up on *this* server. Chat and media travel over **WebRTC** between browsers. NestJS does auth, rooms, and signaling only — it never relays message bodies or call media.

## Current status

Working today:

- Public signup / sign-in / sign-out (Passport Local + session cookie)
- Room directory, group create/join, and 1:1 DMs
- Authenticated signaling WebSocket (`GET /api/signal/ticket`, then `/ws`)
- P2P text over WebRTC data channels, kept in local history
- 1:1 and small-group audio/video on the same mesh (join/leave, mute, camera)
- Landing, auth pages, and `/app` / `/app/c/:id`
- Unit, API, coverage, and Playwright auth, chat, and call e2e

A/V mesh cap is **6 peers** (`AV_MESH_CAP`). Text-only rooms can be larger. No cloud STUN/TURN; host ICE candidates on this LAN.

## Stack

| Piece | Choice |
| --- | --- |
| Client | Vite, SolidJS, TypeScript, Tailwind |
| API | NestJS (on-prem, one Node process) |
| Data | lowdb JSON (`data/db.json`, gitignored) |
| Validation | Zod |
| Auth | Passport Local + `express-session` |
| Transport | WebRTC data-channel + media mesh; Nest WebSocket for SDP/ICE only |
| FP / reactive | fp-ts (pure), Effect (IO), RxJS (streams), Solid signals (view) |
| Tests | Vitest, Supertest, Playwright, V8 coverage |
| Quality | ESLint, Husky (`pre-commit` tests, `pre-push` e2e) |

No cloud services at runtime. No OAuth. Optional later: self-hosted coturn on the same premises (not Google/Twilio STUN).

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

On Unix, use `cp .env.example .env`. Set `SESSION_SECRET` in `.env` before any real use.

## Run

```bash
npm run dev
```

- Client: [http://127.0.0.1:5173](http://127.0.0.1:5173)
- API: [http://127.0.0.1:3000/api/health](http://127.0.0.1:3000/api/health)

Vite proxies `/api` and `/ws` to Nest. Create an account, then open `general` (or start a DM). Chat bodies and call media never hit the API — only join/SDP/ICE do. Join a call from the conversation header.

Production shape (later): `npm run build`, then Nest serves `client/dist` plus `/api` from one process.

## Test and lint

```bash
npm test          # Vitest + V8 coverage (shared + server)
npm run test:e2e  # Playwright (auth, two-peer text, two-peer call)
npm run lint      # ESLint
```

Coverage HTML is written to `coverage/` (gitignored). `npm test` fails if lines/statements/functions drop below **80%** or branches below **70%**.

Husky runs `npm test` on commit and `npm run test:e2e` on push. Do not use `--no-verify` unless asked.

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
