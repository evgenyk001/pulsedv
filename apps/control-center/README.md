# PULSE Control Center

Private operational application for the PULSE.DV team.

This app is intentionally separate from `apps/mini-app`:
- separate bundle and deployment;
- separate authentication/RBAC boundary;
- no admin routes or admin UI shipped to Telegram users;
- shared domain models/API contracts will move into packages later.

Current stage: standalone shell and CI boundary. The preserved Floot admin baseline lives under `apps/floot-mirror/current` and will be migrated into this app screen-by-screen.
