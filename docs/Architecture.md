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
| Message history, unread | Yes (`data/db.json`) |
| Attachment bytes (file or folder zip) | Yes (`data/files/`; metadata in `db.json`) |
| Live text (when a peer is connected) | Also WebRTC data channel |
| Call audio / video | Yes — Nest SFU forwards RTP; each caller uploads once |
| SDP / ICE / call roster / SFU signaling | Yes (`/ws`) |
| ICE servers (`GET /api/ice`) | Yes — used by the text mesh and each SFU uplink |

Sending a message POSTs it for history, then fans it out over the data channel when a peer is online. Inbox activity frames update unread and last-message without an open thread.

A/V uses a **selective forwarding unit** in Nest (`werift`). Each caller has one WebRTC connection to this server. Nest forwards that media to the other people in the call (cap `AV_MESH_CAP`, 16). Audio and video added in the same moment are offered together, and `sfu-route` mids are published after the SFU sets the local description. A caller that is still waiting for the SFU’s answer queues a later offer instead of rolling back. Live text still uses a peer-to-peer data-channel mesh; camera and mic are not sent to members who have not joined the call. Call tiles keep the `<video>` muted (autoplay) and attach remote audio to a hidden `<audio>` element.

## Stack

Client: Vite, SolidJS, TypeScript, Tailwind  
API: NestJS, Passport Local + session cookie, lowdb  
Validation: Zod  
FP / reactive: fp-ts, Effect, RxJS, Solid signals  
Quality: ESLint (complexity max 10), Husky, Vitest, Playwright
