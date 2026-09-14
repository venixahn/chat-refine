# Features

Working on `develop`:

- Public signup / sign-in / sign-out
- Room directory, group create/join, 1:1 DMs
- Authenticated signaling and ICE list
- P2P text plus server-stored history. An open room also pulls history when activity arrives, so text still shows if the data channel is not up yet.
- Slack-like thread: left-aligned messages with avatar, name, and time; consecutive messages from the same person are grouped. Boxed composer (`Message {room}`). Sidebar uses a compact workspace header, `#` channels, and unread bold.
- Unread counts and last-message previews
- Attachments: one Attach control for files or a folder (the folder input sets `webkitdirectory`; folders become a zip)
- Desktop notifications (opt-in **Notify**)
- Profile: display name, bio, status, 36 built-in avatars or upload
- Preferences: theme (dark / light / system) and search visibility
- Light markdown in messages
- 1:1 and group audio/video via Nest SFU (join/leave, mute, camera, cap 16). Dev Vite is HTTPS so camera/mic work on localhost and LAN (accept the self-signed cert). Remote tiles mute the video element and play audio separately so autoplay is allowed.
- Stacked mobile layout

A/V cap is `AV_MESH_CAP` (16). Each caller uploads once; Nest forwards to the others. The text mesh is a data channel only — it does not attach camera or mic. Text-only rooms can be larger.

Shipped vs open: [Project-status](Project-status.md). Sequenced next work: [Roadmap](Roadmap.md). System diagram: [Architecture](Architecture.md).
