# PULSE Control Studio

Presentation release following the record workspace release. It preserves the API, database, authentication, role permissions, financial calculations, notifications, campaign rules and Mini App. No third-party CRM source was copied. The reference products informed the collection / preview / full workspace organization only.

## Interface

- Day: near-white gray workspace, opaque white working surfaces, fine dividers and restrained shadows. Night: deep graphite surfaces, lighter gray working layers, blurred translucent navigation and inspection panels. Neither theme uses pure black as its workspace background.
- A shared semantic palette covers all fourteen routes, login, record editors, confirmation dialogs, custom selects, tooltips, communication, partner operations and campaign editors. Historical layout rules remain isolated in cascade layers; `studio.css` owns the presentation. Existing detail and conversation tokens are explicitly mapped to the current palette.
- Day, Night and System are available from the shell, login and personal appearance settings. The choice persists locally, synchronizes between tabs, observes system-theme changes in System mode and tolerates unavailable local storage. It does not change team settings or send an API write.
- Leads use a single collection surface containing mode tabs, search, stage filter, table/board selector and aligned rows. Stage filters reuse the existing server search. Search results retain their own record snapshot for inspection even if the result is outside the initial loaded collection.
- Lead and visitor rows open a read-only quick preview. A separate action opens the existing full editor with its original save, validation, conflict and dirty-exit checks. Deep links continue to open the full record directly. Preview panels retain the shared focus trap and background isolation.
- Summary metrics use unified strips rather than separate floating panels. Long screens expose section-jump navigation derived from the rendered section headings; it never changes router state or replaces existing section IDs.
- Desktop records use the available workspace. Mobile uses a full-screen record with a single scrolling body and a fixed action footer. Floorplans retain their existing two-column phone grid and source identifiers. Tablets can scroll wide data tables inside the collection without horizontal page scrolling.

## Verification

Build and type checks cover all workspaces. Browser checks use the production Control build against the existing isolated API/PGlite fixture; no real client data, messages, money or production account settings are involved.

Acceptance observations for this release:

- All fourteen route shells at desktop and 320/390px phone frames; page overflow, theme appearance and mobile heading spacing.
- Day/Night selection and persistence after reload; light and graphite surfaces in collections, overview and editors.
- Lead row -> preview -> full editor -> next-action edit -> save -> reload confirms actual API persistence.
- Dirty record -> close -> cancel retains the editor; closing with confirmation discards the unsaved draft.
- Stage filter uses the API and reduces the list to the selected stage; reset returns the normal collection.
- A catalog record with 20 plans displays two phone columns, no out-of-bounds controls and a footer inside the viewport. Mobile navigation retains background isolation.

Responsive Chromium frames do not replace physical iPhone/Safari acceptance. A newly encountered screen size or a different data shape can still need adjustment. Browser testing is interactive; this note does not claim an automated end-to-end suite was run.

## Installation

`deploy/update-control-studio.sh <40-character-release-SHA>` follows the existing web-only installer. It takes the shared deployment lock, preserves the previous web image, validates the source scope and Caddy configuration, builds a unique web image, restarts web only, compares installed HTML/JS/CSS over local HTTPS and checks API readiness. API, worker and database are not restarted or migrated. Activation/verification failure attempts to restore the saved web image. Keep the printed recovery directory until acceptance.

The release is cumulative from the previous Control workspace release. It can include earlier web-only UI updates allowed by the installer, but it intentionally rejects unrelated source changes and non-ancestor deployments.
