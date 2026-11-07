# Giveaway experience — 7 November 2026

The Mini App giveaway page uses the shared application surfaces, primary buttons, card geometry and light/dark tokens. Prize artwork and the server-synchronised countdown form one hero. Participation is the primary action; full configured rules and explanatory answers are collapsible.

The page distinguishes an unsubmitted application, pending review, confirmed ticket(s), and rejection. Submitting an application does not issue a ticket. Confirmation, ticket generation and bot delivery continue to use the existing backend and Control workflow. The conversation button opens the existing account conversation route with the giveaway entry context.

No backend, database, authentication or campaign settings change. Existing prize text, dates, rules, entries and ticket numbers are loaded from the API. The home carousel and shared countdown retain their existing standalone styles.

## Validation

- Mini App TypeScript check and production build.
- Browser QA using the actual page and AppShell in tests/fixtures/giveaway with synthetic data and no live API.
- Consent gating, rule expansion/collapse, pending application after submit and conversation routing.
- Browser inspection at 390px, and 320px with dark mode, a long title and multiple tickets. The latter exposed hero overflow: its fixed aspect ratio was removed so the title stays in normal document flow. The browser policy blocked the final reload, so the last CSS adjustment was typechecked/built but not visually rechecked.
- Fixture scenarios remain available for rejected, future, closed, pending after closure and disabled campaigns; those were not browser-tested in this pass.

## Installation

`deploy/update-giveaway-experience.sh <immutable release SHA>` updates web only. It accepts cumulative UI changes from the preceding Control Studio/workspace releases, verifies fast-forward ancestry and path scope, preserves a recoverable old web image, validates Caddy, and compares local HTTPS HTML/JS/CSS for both interfaces before checking API ready. It does not restart API, worker or database. A failed activation attempts to restore the previous web image; review the saved recovery directory on error.

The installer intentionally stops for unrelated source changes, staged changes, non-ancestor releases, or unexpected Caddy customisation. Do not bypass those checks with a hard reset.
