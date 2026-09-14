# chat-refine

On-premises peer-to-peer chat: 1:1 and small-group **text, audio, and video**.

Live text travels over **WebRTC** between browsers, and an open thread also pulls Nest history when activity arrives. Call media goes through Nest’s SFU (one upload per caller; both sides see forwarded video). Nest also does auth, rooms, signaling, and persisted chat history.

This folder is the project wiki. GitHub Wiki is not available on a private free-plan repository, so docs live here and on the [chat-refine wiki](https://github.com/users/venix523/projects/1) project board.

## Pages

- [Setup](Setup.md) — install, run, test, coturn for hard NAT
- [Architecture](Architecture.md) — system diagram, SFU, P2P text, history
- [Features](Features.md) — what works today, including attachments, profile, and search
- [Project-status](Project-status.md) — snapshot of what ships, gaps, and next work
- [Roadmap](Roadmap.md) — sequenced Now / Next / Later
- [Git-Flow](Git-Flow.md) — branches and cleanup

## Code

- Repo: https://github.com/venix523/chat-refine
- Integration branch: `develop`
- Project: https://github.com/users/venix523/projects/1
