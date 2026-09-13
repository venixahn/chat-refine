# Architecture

```
client/   Solid + Vite UI
server/   NestJS API and signaling WebSocket
shared/   Zod schemas and pure helpers
e2e/      Playwright
data/     local JSON database (gitignored)
docs/     this wiki
```

## Transport

| Path | Goes through Nest? |
| --- | --- |
| Signup, rooms, profile | Yes |
| Message history, unread, files | Yes (`data/db.json`) |
| Live text (when a peer is connected) | Also WebRTC data channel |
| Call audio / video | No — WebRTC media only, and only among peers in the call |
| SDP / ICE / call roster | Yes (`/ws`) |

Sending a message POSTs it for history, then fans it out over the data channel when a peer is online. Inbox activity frames update unread and last-message without an open thread.

A/V is a full mesh of WebRTC media tracks among people who clicked **Join call** (cap `AV_MESH_CAP`). Nest tracks that roster and rejects a seventh peer. Text data channels stay up for the whole room; camera and mic are not sent to members who have not joined the call.

## Stack

Client: Vite, SolidJS, TypeScript, Tailwind  
API: NestJS, Passport Local + session cookie, lowdb  
Validation: Zod  
FP / reactive: fp-ts, Effect, RxJS, Solid signals  
Quality: ESLint (complexity max 10), Husky, Vitest, Playwright
