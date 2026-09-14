# Features

Working on `develop`:

- Public signup / sign-in / sign-out
- Room directory, group create/join, 1:1 DMs
- Authenticated signaling and ICE list
- P2P text plus server-stored history
- Sent messages on the right, received on the left
- Unread counts and last-message previews
- File and folder sharing (any type; folders become a zip)
- Desktop notifications (opt-in **Notify**)
- Profile: display name, bio, status, 36 built-in avatars or upload
- Preferences: theme (dark / light / system) and search visibility
- Light markdown in messages
- 1:1 and group audio/video via Nest SFU (join/leave, mute, camera, cap 16)
- Stacked mobile layout

A/V cap is `AV_MESH_CAP` (16). Each caller uploads once; Nest forwards to the others. Text-only rooms can be larger.

Shipped vs open, coverage, and next work: [Project-status](Project-status.md).
