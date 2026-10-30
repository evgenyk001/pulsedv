# Control: cities and responsive workspace

The Objects city selector uses every city represented in the catalog, including cities with only drafts or archived projects. City lives in the hash-router query string, survives refresh and browser Back, and combines with search, status and review filters. New projects inherit the selected city. The city field also suggests existing cities without preventing a new city name.

`GET /api/v1/control/catalog-summary` is editor-only (owner/admin). One aggregate query supplies city/status totals for the complete catalog without fetching property bodies. Public metadata and manager permissions remain unchanged. Summary totals describe the selected city, independently of the list's search/status/review filter. Listing remains paginated at 24 records. Search waits 220 ms, cancels obsolete reads and times out after 12 seconds. Failed reads provide retry instead of a misleading empty catalog.

Shared Control styles use the compact navigation through 1024 px. Runtime and pending-save bars are measured, so drawers and the sticky workspace header account for their actual heights. Mobile navigation locks background interaction and traps/restores keyboard focus; hidden navigation is inert. Editor fields, wrapping, table/card spacing, banners, chart controls and touch sizes were checked at 320, 390, 768, 1024, 1280 and 1440 px. Bulk import is a native expandable section; unavailable cover images show a placeholder.

## Validation

- Backend suite: 180 passing tests, including city aggregates, pagination/status combinations, renamed cities, empty catalog and anonymous/manager access denial.
- Chromium: all 13 Control sections at six viewport widths, populated lead/profile editors, city creation and refresh/history, partner financial review, broadcasts, finance and existing business flows.
- API-mode Control integration uses the real Fastify routes and isolated PGlite database: login, complete city choices beyond the first catalog page, pagination reset, project create/save, failed request retry, timeout, account-security dialog, server-only team settings and pending-save bar geometry.
- Workspace type/SEO checks and API-mode production build.
- Installer shell syntax checked. Docker/VPS activation is performed by the installer on the target host; a production deployment was not run from this workspace. Viewport checks use Chromium and do not replace a physical iPhone/WebKit check.

## Deployment

Run the checksum-verified `deploy/update-control-polish.sh` at its pinned release commit, using the PuTTY block accompanying the release. Requires the previously installed chat/database schema. The installer refuses extra migrations, Compose changes, dirty source files and unreviewed Caddy configurations.

The installer saves settings, a PostgreSQL dump, media archive and actual previous image tags; verifies the dump listing and archive integrity; rebuilds API/worker/web; validates Caddy; starts the services; checks running image IDs, catalog-summary query, HTTPS readiness, exact served Control HTML and www redirect. No migrations run. Failures trigger restoration of previous images/configuration. The source checkout can remain on the new commit after rollback, and the backup path is printed. DNS and reachability from Russian networks are outside these loopback checks.
