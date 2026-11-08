# PULSEDV cinematic landing proposal

Review-only successor to the dual-entry proposal. Production dist, app code,
backend, acquisition tracking and server configuration are unchanged.

A 37-second loop presents five scenes: home/catalog, property/floorplan,
favorites/mortgage, partner programme, giveaway. New phone pairs enter from the
right as the previous pair exits left, with different positions, scale and roll.
Continuous red/graphite curves morph between scene-specific paths. Each scene
has a short benefit caption, an accessible scene selector and a pause control.
Reduced-motion visitors get a still composition with manual scene navigation.
The animation pauses in hidden tabs and when the stage is outside the viewport.

Phones are original Blender/Cycles renders with titanium chassis, rounded glass,
side buttons, antenna seams, Dynamic Island and studio lighting. Eight transparent
WebP assets total under 1 MB. Browser animation uses transforms and SVG; no WebGL,
external runtime libraries, live API calls or video downloads are required.
If assets or JavaScript fail, the two screenshot phone fallback remains visible.

## Screenshot sources

Screens were captured from the actual React application components on branch
`design/landing-dual-entry`, at a 390 × 844 viewport. Public catalog/state and
Mezhdurechye property detail were retrieved from pulsedv.ru on 8 November 2026;
images, prices and floorplans come from that public snapshot. Favorites are a
local illustrative selection, not a real customer's account. Mortgage is the
application's own illustrative calculation, not an approved bank offer.
Partner screen is the public programme introduction; it contains no earnings,
referrals, customer data or claims of completed payouts.

Giveaway uses the real GiveawayPage and campaign artwork with source-defined
DEFAULT_GIVEAWAY settings enabled in an isolated local capture only. No entry or
ticket is created. Its countdown is a screenshot, not a live counter. Production
campaign dates/settings and availability must be verified before publishing the
proposal on pulsedv.ru. The iPhone artwork inside the giveaway is illustrative.

## Preview

Run `npm run dev` from this directory, then open the printed local server URL.
The optional `/capture-frame` route requires an ignored local `.qa/built` app
capture build. `/mobile-review?width=390` provides an isolated viewport for QA.
Neither route changes the production application.

To recreate device renders: run `python3 source/prepare_screens.py`, then
`blender -b -t 8 --python source/render_phones.py`. Convert generated transparent
PNGs to WebP with Pillow. The browser runtime has no build or install step.

Keep both equal entry paths, the existing Instagram destination and acquisition
attribution when integrating with the production landing. App Store remains an
inactive development status. This proposal does not enable or deploy /app/.
