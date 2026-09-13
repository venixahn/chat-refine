# Features

Working on `develop`:

- Public signup / sign-in / sign-out
- Room directory, group create/join, 1:1 DMs
- Authenticated signaling and ICE list
- P2P text plus server-stored history
- Unread counts and last-message previews
- Small file / image sharing (about 1 MB)
- Desktop notifications (opt-in **Notify**)
- Edit display name and avatar
- Light markdown in messages
- 1:1 and group audio/video via Nest SFU (join/leave, mute, camera, cap 16)
- Stacked mobile layout

A/V cap is `AV_MESH_CAP` (16). Each caller uploads once; Nest forwards to the others. Text-only rooms can be larger.
