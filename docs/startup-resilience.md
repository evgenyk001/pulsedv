# Startup resilience

The Mini App renders its loading/recovery UI before public bootstrap or authentication completes. The official Telegram SDK loads asynchronously in the document head; the independent launch guard calls `ready()` and `expand()` when the SDK becomes available, including when the app bundle fails. Runtime mounting also prepares the Telegram window.

Public state/session/cookie requests start without waiting for the SDK. Ordinary browser visits can browse public screens even if the SDK is unavailable. Telegram launches (including cached launch parameters after a router reload) wait for SDK load before identity binding, with an eight-second timeout and a visible retry. Retry uses a distinct request URL so a still-pending first download cannot absorb the replacement request. Private screens and mandatory phone registration remain behind server authentication; a missing SDK does not imply a successful anonymous Telegram login. Referral navigation is applied after SDK initialization so late signed launch parameters are preserved.

Both applications use `AppBoundary` above their runtime gates, providers and routers. The Mini App also keeps its per-route boundary. Static launch recovery remains independent of the app bundle.

Active applications and shared browser packages use `safeLocalStorage` and `safeSessionStorage`. Access failures and quota errors fall back to memory for the current document, with separate stores and deletion tombstones. `setItem`/`removeItem` return whether persistence succeeded; broadcast drafts retain their existing persistence warnings. Memory fallback does not survive a reload or synchronize across devices. Server account data remains authoritative.

API requests no longer require the static `AbortSignal.timeout` or `AbortSignal.any` methods. The existing twelve-second default timeout covers body reading as well as response headers. Explicit caller signals retain their previous timeout/cancellation policy, including longer attachment uploads. Aborted/truncated JSON cannot be accepted as a successful empty bootstrap.

`deploy/Caddyfile` records the reviewed production host routing: HTTP/1.1 and HTTP/2, `Alt-Svc: clear`, filtered access logging and the `www` canonical redirect. Temporary debug logging is omitted. Certificate data volumes remain unchanged.

`deploy/update-startup-resilience.sh RELEASE_SHA` backs up local config and tags the running web image, checks config changes against the known reviewed config, validates the replacement Caddy image, updates only `web`, and verifies local HTTPS readiness, new Mini App HTML and the exact `www` redirect. It refuses unexpected local Caddy changes instead of replacing them. Activation failures restore the previous image and saved host configuration. There are no database migrations or database/media mutations. Docker production rollout must still run on the target VPS.

These changes address reproduced application startup failures. They do not establish or fix the separately observed TLS handshake timeout on `/ready`. Successful loopback/external probes do not prove reachability from the affected phone/network. DNS caching remains a hypothesis; the captured failed TCP connections did reach the intended VPS.
