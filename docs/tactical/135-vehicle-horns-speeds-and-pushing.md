# 135 — Vehicle horns, speeds and gentle pushing

Date: 2026-10-18.
Status: Complete; validated.
Owner: [Vehicles](../topics/vehicles.md); [trains](../topics/trains.md).

The owner authorized the full gameplay proposal and a completion commit: a horn
button, speeds matching vehicle character, and gentle pushing by cars/trains.

## Delivered behavior

- Horn/H is a contextual screen button on desktop and touch; trains say Whistle.
  Keyboard and touch presses latch across simulation frames, including a complete
  quick tap. Existing Fast, emergency styles, sirens and beacons remain available. Authority
  verifies the inside driver and relays transient spatial start/refresh/stop events
  to nearby realm clients. Holding sounds one continuous car, heavy or train voice;
  releasing stops it. Input refreshes every 200ms; abandoned server holds expire
  after 600ms and browser voices after 700ms without refresh. Seat exit, menus and
  focus loss stop playback. Traffic consumes the same Worker event through AudioManager.
- VehiclePerformance owns speed/acceleration and contact capacity, independent of
  immutable art. Low sporty cars 21–26 have the highest ordinary speed; heavy
  buses/trucks accelerate slowly. Shared authority/prediction retain diagonal
  normalization and 1.6× held boost. Parking translates its existing target speeds
  through the selected profile rather than unintentionally changing maneuver speed.
- VehiclePush plans without mutating bodies. Driven cars and all straight/curved
  trains commit only after complete body, ground, pushed-body and passenger checks.
  Contact caps slow the vehicle; no damage or passive launch velocity is added.
  Other people/fixed bodies, walls, water, ledges and unready chunks block pushing;
  no chains. Larger vehicles have larger speed/weight limits. Roof riders retain
  moving-support ownership. Automatic road traffic continues to yield.
- Car prediction uses private displaced collision copies over pending input and
  clears them on authority rebase, retaining ordinary replay ownership and immutable
  replica bodies. Game and embedded scenarios share all simulation changes.

## Validation

Final checks passed: typecheck, all 2,669 unit tests across 271 files, lint
(existing warnings only), production build and all 640 Playwright tests. The
streaming readiness benchmark also passed, with zero missing-data or incomplete-cache
frames during walk, sprint and reverse.

Regression coverage includes actual profile speeds
and boosts, sustained prediction against a frozen replica, atomic/blocked pushes,
straight/curved train contact, roofs, source-body immutability, horn authorization,
cooldown, binary fallback, spatial tone scheduling and touch release. Browser
vehicle-driving coverage exercises keyboard and actual screen-button horns for
cars and trains, retaining existing saved-seat/exit and tap/hold driving checks.

Generated catalog/Workshop inventories are refreshed through their normal compilers;
the manifest verifies 816 identities. All 180 vehicle review records remain unchanged;
172 other behavior/source fingerprints were renewed. No art approval is inferred
and promoted sprite/collision/model banks stay immutable.

## Held-horn correction (2026-10-18)

The owner clarified that H and the screen button must sound for the entire hold.
Replaced fixed-duration one-shots and their 800ms cooldown with a driver-verified
hold lease and a continuous per-vehicle oscillator group. Heartbeats update position
and loudness without retriggering the sound. Explicit releases bypass refresh
throttling, so releasing and pressing again works immediately. No saved state or
art bytes change. Traffic lab pointer/keyboard controls use the same authority and
audio lifecycle, including cancellation and disposal.

Server tests cover a multi-second hold, immediate release
and re-press, expiry and editor rejection; audio tests prove oscillator reuse over
a four-second hold and cleanup on release/lost refresh. Browser coverage holds H
and the actual touch button past the former duration, releases each and checks
focus-loss cancellation for both cars and trains. All 16 affected car/train and
emergency-vehicle browser scenarios pass on Canvas/GPU and authored mesh variants.
Typecheck, lint (existing warnings only), build, catalog/manifest generation and
streaming readiness pass. The unit run passed 2,669 tests with one unrelated 5s
sidewalk-routing timeout during concurrent compilation; all 11 tests in that file
passed on isolated rerun alongside the 27 audio/driver checks. The manifest still
verifies 816 candidates; all 180 vehicle records are unchanged.

Validation used a temporary copy of HEAD plus this correction, with isolated auth
and bundled Chromium, because unrelated interior work was changing concurrently.
The completion commit includes only the horn correction and its inventories/docs.

## Next

Playtest horn loudness, sporty-car speed and heavy-vehicle contact strength together
in co-op; tune the shared profiles from that feedback.
