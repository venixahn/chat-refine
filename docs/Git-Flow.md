# Git Flow

- `main` — production (release / hotfix only)
- `develop` — integration
- `feature/<name>` — from `develop`, merge back to `develop`
- `release/*` / `hotfix/*` — stabilize or patch production

Atomic commits, conventional messages (`feat:`, `fix:`, `test:`, `refactor:`). Push after each green commit. Do not skip hooks.

After a feature is merged into `develop`, delete that feature branch locally and on `origin`. Keep `main` and `develop`.
