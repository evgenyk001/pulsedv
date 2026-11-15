# PWA / Telegram Mini App — parity audit (15 Nov 2026)

Base: `release/pwa-update-menu-20261115` (not `main`). Do not deploy or merge without validating live build and API.

## Confirmed from source
- Giveaway UI: `apps/mini-app/src/pages/giveaway.tsx` line 76 branches on `runtime.publicPreview`. Preview shows only "Прочитать правила", not the registration checkbox/button. The preview build is intentionally unauthenticated; removing the guard without auth is NOT a fix.
- For an existing giveaway entry, the same page shows entry status and "Обсудить покупку" instead of the registration button. This is expected for a pending entry, but must be verified against the same user account.
- `backend/src/giveawayRoutes.ts`: `/api/v1/me/giveaway` and `/api/v1/control/giveaway` share the database. POST requires registered phone and current consent; duplicate phone is rejected. Never bypass these checks.
- `apps/mini-app/src/main.tsx`: `VITE_PWA_PREVIEW=true` sets `publicPreview`; `apps/mini-app/src/pwa/preview.tsx` is a distinct preview entrypoint.
- `backend/src/searchRoutes.ts`: both clients use `/api/v1/me/search` with a shared owner model. PWA push and Telegram notifications are distinct delivery channels.
- `apps/mini-app/src/pages/my-search.tsx`: redundant PWA-specific grey notification-permission hint was removed in this branch. No permission handling was altered.
- `apps/mini-app/src/pages/profile.tsx`: selection history is read from `pulse_selection_history` local storage and is not necessarily synchronized across clients.
- `backend/src/clientChannels.ts` and `apps/control-center/src/pages/AnalyticsPage.tsx`: channel split exists; verify events and reporting against real sessions.

## Required runtime checks
1. Confirm installed PWA URL, build version, and whether preview flag is set; inspect deployed `app-release.json`. Preview must remain a read-only test environment.
2. With the same verified account in Mini App and production PWA, compare GET `/me/giveaway`: same entry ID/status/tickets. A new verified account must see rules acceptance and registration; submitting must create exactly one pending entry visible in Control.
3. Verify notification permissions separately from subscription settings: iOS PWA push requires installed app and OS permission; Telegram delivery depends on bot linkage. Ensure no toggle falsely claims active delivery.
4. Compare saved search criteria/feed, favorites, chat/journeys, catalog, mortgage, partner program, giveaway, announcements, and profile across clients.
5. Decide whether local selection history should be server-synced. Do not migrate without a data model and deduplication strategy.
6. Validate client-channel analytics and lead last activity on real test users, including switching between clients.
7. Run typecheck, unit tests, backend tests, build, mobile Safari PWA smoke tests, and Telegram WebView smoke tests. Verify cache/update flow and keyboard viewport before release.

## Release safety
- Do not modify `main`, merge, or deploy until tests pass.
- Preserve the existing PWA update-menu, status-bar, chat viewport and analytics changes.
- This branch currently includes only the redundant search hint removal and this audit note.
