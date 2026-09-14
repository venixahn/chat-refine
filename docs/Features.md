# Features

Working on `develop`:

- Public signup / sign-in / sign-out
- Room directory, group create/join, 1:1 DMs
- Authenticated signaling and ICE list
- P2P text plus server-stored history
- Sent messages on the right, received on the left
- Unread counts and last-message previews
- Attachments: one Attach control for files or a folder (folders become a zip)
- Desktop notifications (opt-in **Notify**)
- Profile: display name, bio, status, 36 built-in avatars or upload
- Preferences: theme (dark / light / system) and search visibility
- Light markdown in messages
- 1:1 and group audio/video via Nest SFU (join/leave, mute, camera, cap 16; camera/mic need http://127.0.0.1 or HTTPS). Remote tiles mute the video element and play audio separately so autoplay is allowed.
- Stacked mobile layout

A/V cap is `AV_MESH_CAP` (16). Each caller uploads once; Nest forwards to the others. Text-only rooms can be larger.

Shipped vs open, coverage, and next work: [Project-status](Project-status.md). System diagram: [Architecture](Architecture.md).
