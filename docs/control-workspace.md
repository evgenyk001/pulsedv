# Control workspace rebuild

Web-only release based on the giveaway page polish release. The Mini App's existing giveaway, sharing and presentation delivery remain in the web build. There are no API, worker, schema or business-setting changes.

## Workspace

- Unified graphite surfaces, readable forms, restrained accent, fixed navigation and consistent spacing across all fourteen sections.
- Fast section navigation with Ctrl/Cmd+K, Enter and Escape, restricted to sections already allowed for the current role. This searches section names, not client records.
- Mobile navigation and drawers keep page content inert where appropriate. Drawer positioning follows the actual workspace bar height. Reduced-motion preferences are respected.
- Overview prioritizes work queues above the activity chart.
- Registered accounts and visitor activity have separate views. Account search shows loading and error states without flashing a false zero.
- Tasks support list and board views. Phones default to a list; search, overdue filters and pagination keep working.
- Lead financial fields are collapsed by default. No finance calculations were changed.
- Analytics identifies sessions, applications, loaded subsets and differing reporting periods. This release does not reconstruct historical identities or introduce a shared reporting-period filter.

## Verification

Run `npm run check -w apps/control-center` and an API-mode Vite build.

For isolated browser verification build Control with `VITE_PULSE_MODE=api VITE_API_BASE_URL=/api/v1 npm run build -w apps/control-center`, then run `node --import tsx tests/fixtures/control-workspace/server.ts`. This fixture always uses an in-memory PGlite database, temporary media and synthetic accounts/projects. It never requires production credentials and is not included in Docker images. Default port: 4173. The root opens the real built Control app with a fixture-only session; `/?width=390&route=leads` provides a phone-sized frame. Stop the server to discard all fixture records.

Browser verification covered fourteen routes on desktop and at 320/390/768/1024px, client and object persistence after reload, task status persistence, empty search and keyboard section navigation. Scope labels do not imply unique-person counts.

## Installation

`deploy/update-control-workspace.sh <reviewed-40-character-release-SHA>` runs from `/opt/pulsedv` and uses the shared deployment lock. It accepts only the reviewed web/test/documentation scope, preserves the current effective Compose configuration, tags or snapshots the old web for rollback, builds a unique new web image, validates Caddy and verifies served HTML/JS/CSS for both interfaces plus `/ready` over HTTPS. It does not restart API/worker or modify the database. An activation or verification failure attempts to restore the previous web image. Keep the printed recovery directory until the updated interface has been checked.
