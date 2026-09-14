# Features

Working on `develop`:

- Public signup / sign-in / sign-out
- Room directory, group create/join, 1:1 DMs
- Authenticated signaling and ICE list
- P2P text plus server-stored history. An open room also pulls history when activity arrives, so text still shows if the data channel is not up yet.
- Slack-like thread: left-aligned messages with avatar, name, and time; consecutive messages from the same person are grouped. Boxed composer (`Message {room}`). Sidebar uses a compact workspace header, `#` channels, and unread bold. Channel header shows members; people in the open thread are marked here.
- Jump to unread (`New messages` divider), search in the thread, edit and delete your own messages
- Jump to unread (`New messages` divider), search in the thread, edit and delete your own messages
- Private channels (invite only) plus a topic and Mute channel. Public rooms still show in Join.
- Unread counts and last-message previews (muted channels stay quiet: no badge, no desktop alert)
- Attachments: one Attach control for files or a folder (the folder input sets `webkitdirectory`; folders become a zip)
- Desktop notifications (opt-in **Notify**)
- Profile: display name, bio, status, 36 built-in avatars or upload
- Preferences: theme (dark / light / system) and search visibility
- Light markdown in messages
- 1:1 and group audio/video via Nest SFU (join/leave, mute, camera, cap 16). Dev Vite is HTTPS so camera/mic work on localhost and LAN (accept the self-signed cert). Remote tiles mute the video element and play audio separately so autoplay is allowed.
- Stacked mobile layout

A/V cap is `AV_MESH_CAP` (16). Each caller uploads once; Nest forwards to the others. The text mesh is a data channel only — it does not attach camera or mic. Text-only rooms can be larger. If “Connecting peers…” hangs, a second line asks the host to add a relay. Keep that first status string as-is (e2e matches it). Hard NAT needs coturn via `ICE_SERVERS` — see [Setup](Setup.md).

Shipped vs open: [Project-status](Project-status.md). Sequenced next work: [Roadmap](Roadmap.md). System diagram: [Architecture](Architecture.md).
