# PULSE Control Center

Private operational application for the PULSE.DV team.

This app is intentionally separate from `apps/mini-app`:
- separate bundle and deployment;
- separate authentication/RBAC boundary;
- no admin routes or admin UI shipped to Telegram users;
- shared domain models/API contracts will move into packages later.

## Current migration state

The standalone app now has routed sections for:
- Overview
- Leads
- Users / activity timeline
- Tasks
- Objects
- Mortgage
- PULSE Select
- Content
- Analytics
- Settings / RBAC

No fake backend data is presented. Screens expose honest empty states and the target operational structure until the shared backend is connected.

The preserved Floot admin baseline lives under `apps/floot-mirror/current` and is the migration reference for endpoint/schema behavior.
