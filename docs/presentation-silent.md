# Silent PDF delivery in Telegram Mini App

Clicking Get presentation queues the same authenticated PDF delivery to the bot.
Pending and successful delivery no longer add a floating panel or an Open bot
link. The existing action stays disabled during delivery to avoid repeat clicks.
Errors and unavailable files remain visible and actionable; failures do not
pretend to be successful. No automatic navigation or Telegram popup is added.

This release contains no PWA work. The web-only updater accepts the preceding
Control Studio and giveaway interface releases, requires fast-forward ancestry,
preserves the old web image and checks served HTML/JS/CSS and API readiness.
It leaves API, worker, database and server environment settings in place.
