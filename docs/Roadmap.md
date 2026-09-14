# Roadmap

Late alpha on `develop`. The core loop ships: signup, rooms and DMs, history, inbox, attachments, profile, people search, Slack-like thread, and SFU calls. This page sequences what is left. Snapshot: [Project-status](Project-status.md). UX stays Slack-like — quiet chrome, no protocol jargon in the UI.

Do not promote `develop` to `main` until production serve is decided. `main` is still the rooms/signaling tag.

## Now — usable beyond this LAN

Friction that blocks real use. Order is product value, not git order.

| Work | Why |
| --- | --- |
| Production serve | Nest serves `client/dist`, HTTPS, secure cookies, required `SESSION_SECRET`. Vite-only HTTPS is a dev trick. |
| Release to `main` | Merge `develop` → `main` only after the production shape is chosen. Ask before promoting. |

## Next — Slack-like completeness

Shipped on `develop`. See Done.

## Later — ops and scale

| Work | Why |
| --- | --- |
| SQLite (or similar) | lowdb is one process and not durable under concurrent writers. Only if you outgrow that. |
| Native GitHub Wiki | Locked on a private free-plan repo. Docs stay in `docs/` until that changes. |

## Done — do not reopen as new work

- Server-backed history, unread, last message, notifications
- Attachments (file or folder zip from one Attach control)
- Profile, catalog/upload avatars, theme, visibility, people search
- Nest SFU for call media (werift, cap 16); HTTPS Vite so Join call can open camera/mic
- Slack-like grouped thread and compact `#` sidebar
- In-repo wiki under `docs/`
- Text mesh is data-channel only; leftover A/V on that mesh was removed
- Jump to unread (“New messages”), thread search, edit/delete, private channels + invite, topic, mute channel
- Presence + member list in the channel header (here vs everyone in the room)
- Coturn via `ICE_SERVERS`; `Connecting peers…` stays the e2e string, with a relay hint when ICE stalls
