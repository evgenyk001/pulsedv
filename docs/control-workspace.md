# Control record workspaces

Web-only release following the first workspace polish. The Mini App, API, worker, database schema, authentication rules, permissions and financial calculations retain their existing behavior. The shared journey panel accepts an optional select renderer; its default and API commands are unchanged.

## Interaction and layout

- Legacy styles are isolated in a CSS cascade layer. The current workspace stylesheet owns typography, controls, surfaces and responsive geometry instead of fighting historical `!important` overrides.
- Object and client editors fill the available desktop workspace. On phones they fill the viewport. Header, section navigation and save actions are outside the single scrolling body. Visual viewport changes are observed for mobile keyboard geometry.
- Object fields are organized into Main, Buildings, Plans, Photos, Documents, Map and Review. Sections remain mounted so draft values and validation are retained between switches. Mobile objects use a section menu instead of a row of inaccessible off-screen tabs.
- Client details have Overview, Communication, Interest and Deal sections. Visitor profiles separate identity from interest history. Existing save, conflict and access checks remain in effect.
- A common select renderer supplies an opaque popover, selected marker, keyboard navigation and form value semantics. The underlying select remains for existing controlled-value handlers. Native platform date inputs remain available.
- Confirmation dialogs use the same interface. The original messages and decisions are preserved, including warnings about irreversible deletions. Nested dialogs own focus; cancel/Escape returns to the existing draft.
- Page help explains the workflow and metric scope. Price and freshness details offer contextual field explanations.
- Plans support room filters and area/building search. The grid uses four desktop columns, three at intermediate widths and two on phones. Original plan indices/IDs are retained when filtering.
- Content campaigns are collapsed by default. Expanding a campaign edits the existing draft; settings are still published through the global save bar.
- Mobile task lists use rows rather than inheriting the board's horizontal layout. Client table rows show status, manager and next step explicitly.

## Verification

`npm run check -w apps/control-center` and an API-mode production build validate the changed Control sources. Browser QA uses the real built interface, actual API routes and a synthetic in-memory PGlite database. It does not touch production records, send messages to real clients or change account security settings.

Validated workflows include object name + plan price persistence across section switches and page reload, client next-step persistence, task stage persistence, plan room/empty-result filters, draft-exit cancellation, keyboard select/Escape behavior, content draft discard, section help, mobile navigation and quick section search. All fourteen routes were inspected on desktop and at 320/390/768/1024px. Record body/footer bounds were checked independently of page overflow.

This is Chromium browser QA at responsive viewport sizes, not a run on a physical iPhone/Safari. The latter remains a release acceptance check. These checks do not claim every possible data combination is pixel-perfect.

## Isolated QA server

Build with `VITE_PULSE_MODE=api VITE_API_BASE_URL=/api/v1 npm run build -w apps/control-center`, then run `node --import tsx tests/fixtures/control-workspace/server.ts`. Default port: 4173. `/?width=390&route=objects` opens a phone frame. Every preview navigation represents a separate synthetic client for rate-limit isolation. All records, sessions and media are disposable; stopping the process discards them. The fixture is not copied into production Docker images.

## Deployment

`deploy/update-control-workspace.sh <reviewed-40-character-release-SHA>` retains the shared deployment lock, previous web snapshot/tag, effective Compose configuration, unique web image and rollback on activation/verification failure. It validates Caddy and compares installed HTML/JS/CSS for both interfaces through HTTPS, then checks `/ready`. No API/worker restart or database migration is performed. Scope accepts Control and the explicit shared journey UI path, plus the preceding web-only giveaway page release. Keep the printed recovery directory until acceptance testing is complete.
