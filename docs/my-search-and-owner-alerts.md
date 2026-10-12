# Saved search and owner notifications

Working Telegram alerts are delivered only to the active owner, using the owner's Telegram ID in Team settings. Never fall back to a salesperson when the owner has no ID. Members' login codes still go only to the member authenticating; MFA activation is unchanged.

Every new accepted lead queues one owner alert in its creation transaction, even when no salesperson is available. Repeating the same submission returns the original ID without another alert. The message includes the client's name, phone, project, source, available city and next action, with a direct Control link. Client messages, intent changes and showing reminders also go to the owner. Client journey notifications continue to go to the client.

`014_my_search.sql` adds one saved-search profile per visitor/user. Criteria and opt-ins are validated server-side; visitors cannot specify another owner's key. Verified Telegram binding migrates the anonymous profile without overwriting an established user profile or granting notification consent.

Saving criteria/favorite tracking takes a baseline of published catalog data. It does not report existing entries as new. The worker checks profiles once a minute, records newly matching projects, changed starting prices in favorites and added floorplans. Only published projects are tracked. This is catalog monitoring, not an inventory or bank-approval integration. Purchase mode is a stored preference, not an eligibility test.

In-app history retains at most 30 changes over 30 days. Telegram updates require an explicit toggle after verified Telegram authentication, and are grouped at most once an hour per client. Starting the bot is also required by Telegram. Turning off/reconfiguring the subscription revokes pending messages and their leases. Enabling it does not replay old updates. Before delivery, consent and published projects are rechecked; digests older than 24 hours are suppressed. A message already being transmitted cannot be recalled. Transport retries provide at-least-once delivery, not a promise of exactly-once delivery across Telegram/network failures.

On GitHub Pages, saved search and the change feed operate locally in the same browser; bot notifications are clearly unavailable. Real cross-device storage, periodic monitoring and delivery require the API, PostgreSQL and worker on VPS. Migrate before updating API/worker. Owner must set their Telegram ID and press Start in @pulsedvbot. Credentials belong on the server, never in the frontend or repository.

Validation: `backend/test/my-search.test.ts` covers ownership, baseline, published-only detection, concurrent scans, consent, hourly digest, failure/retry/cancellation, anonymous migration and owner-only lead delivery. `tests/ui/my-search.spec.ts` covers save/edit, invalid budget, persisted updates, disabling tracking, and mobile widths 320/390/430 in Chromium and WebKit.
