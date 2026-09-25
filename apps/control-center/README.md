# PULSE Control

Private operational application for PULSE.DV.

This app is intentionally separated from `apps/mini-app`. It is **not** deployed by the public GitHub Pages workflow.

Migration order:
1. Authentication + RBAC
2. Leads + user activity timeline
3. Objects/developers/projects
4. Mortgage rules/offers
5. PULSE Select rules
6. Content/banners
7. Analytics/team settings

The preserved Floot admin implementation remains available under `apps/floot-mirror/current` as migration reference.
