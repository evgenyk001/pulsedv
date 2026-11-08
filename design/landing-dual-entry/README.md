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


## Revision: staged transitions and responsive composition

The phone pair exits fully before the next pair enters. Both devices share one
translation; their rotated bounds are constrained to separate lanes. An edge
mask and eased opacity prevent hard cuts. Captions and controls have dedicated
grid rows outside the masked phone stage. Mobile portrait uses one large phone,
with introduction above it and the two entry controls and trust block below.
The viewport grid uses 100svh with no document scrolling. At short heights,
spacing and typography compress while each entry control retains 56px height.

The two oval controls have red/burgundy and graphite gradients, inner glass
highlights, hover lift and pressed states. Desktop tooltips also work on keyboard
focus, with a 300ms delay; mobile tooltips are hidden. The headline ribbon uses
subtle animated shape, light and perspective, honoring reduced motion and pause.
The avatar photos are illustrative and blurred. Rating 4.9 and 500+ are supplied
marketing copy from the user; no independent customer/rating verification was
performed. PWA uses browser storage; the tooltip deliberately avoids the
technically false claim that it takes no device memory.

Device geometry now comes from Apple's official iPhone 18 Pro AR asset. Product
studio renders use five finishes and two relative device sizes. Orange/navy
17-series styling is a front-focused visual adaptation of that geometry, not a
claim of an exact CAD replica of every requested model. The original USDZ is
not redistributed. `source/prepare_device_model.py` downloads and converts the
reference using usd-core; `source/render_phones.py` renders it in Blender.

References:
- https://www.apple.com/iphone-18-pro/
- https://www.apple.com/iphone-18-pro/specs/
- https://support.apple.com/en-us/125090


Final visual refinements: mobile portrait content is centered; entry buttons are
oval and slightly narrower. Desktop entry controls sit lower in the column.
The ribbon uses smoothly interpolated SVG curves with a restrained light pass;
its letters stay readable. Pause, reduced motion and hidden-tab handling cover
both CSS and SVG animation. Lower rear lighting was removed/repositioned to
eliminate the repeated bright lower-left rim highlight across device renders.

Validation: 320×568, 390×844 and 1366×768 document overflow checked at zero on
both axes. Both small-mobile entry controls measure 56px high. All five desktop
scenes keep one pair mounted; measured rotated image gaps were 46–49px and
caption gaps 74–83px at 1363×936. Desktop focus tooltip delay is 300ms. Production
app/backend and pulsedv.ru deployment remain outside this proposal change.


Desktop feature strip: three consistent local Lottie JSON assets for catalog,
mortgage and partnerships fill the gap between introduction and entry controls.
They share 1.5px round red strokes, a short reveal and pointer-hover replay.
The local Lottie-light runtime and license are included. Static SVG fallback,
reduced motion, global pause and visibility handling are preserved. The strip
is hidden on mobile portrait to keep the centered single-screen composition.


## Motion/loading refinement

Removed visible pause, scene indicators and the duplicated marketing footer.
Captions and the App Store development status now have separate clear space.
Reduced motion and hidden-tab suspension remain supported; Escape toggles motion
without adding slideshow controls to the composition.

First-scene images get high-priority preload and decode before entrance. Remaining
screens warm sequentially during idle time. Every transition rechecks decode
readiness before starting the outgoing motion; current pictures remain visible
on slow/failed loads. The eight decoded Image elements are reused between scenes.
Bitmap size is 560×1152 and total device assets drop from 762456 to 487176 bytes
(36%). Per-phone CSS drop shadows are removed; only compositor transforms and
opacity change in the animation loop. Dimensions are assigned on scene/viewport
changes rather than every frame. SVG paths update at 30fps; phone motion uses rAF.
Reading dwell remains 6.5 seconds. Exit is 0.72s; entrance is 1.10s with faster
initial travel and a soft ease-out. The pair remains lane-separated throughout.

Browser verification: 1366×568 and 390×844 overflow is zero on both axes;
App Store/captions remain inside the viewport. Later automatic scenes show
complete, explicitly decoded bitmaps. No visible slideshow controls/footer remain.
