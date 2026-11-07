# Jump park and race tunes

Status: lab delivered for owner/child play review; generated venue not started.
Owner request, 2026-11-07: the speedway depot bridge ramp is a favourite. Add a
motocross-style track with ramps of varying steepness and length, curved lips
for air, and faster cars with stronger Shift boosts. Start with a jump lab.
Owners: [vehicles](../topics/vehicles.md), [embedded engine labs](../topics/embedded-engine-labs.md).

## Delivered

- **Jump park fixture.** Workshop → World geometry lab → `car-jumps`
  (`/tilefun/workshop.html?geometry=car-jumps#/tool/world-geometry`, optional
  `&lane=` and `&vehicle=`). Data-only `scenarios/JumpParkRecipe.ts` on the
  ordinary ScenarioSession/Realm/Worker, shared physics, prediction and renderer.
  Each lane button restarts with the driver seated at that lane's start line.
- **Lanes** (west→east, 128px wide, 768px run-up):
  - `kicker`: curved lip of four steepening planes to 48px (final grade 0.56),
    gap, eased landing hill.
  - `sky`: five-plane quarter-pipe lip to 80px (final grade 0.75), longer gap,
    eased 64px landing hill.
  - `double`: straight 0.375 takeoff (the depot bridge grade), gap, landing hill.
  - `tabletop`: long gentle face with a small 0.25 lip, 256px table, landing.
  - `rollers`: five 12px whoops.
- **Geometry rule.** Pieces are split into coplanar slabs rising ≤12px whose
  undersides meet the ground at their low ends, so the profile renders as a
  short embankment and leaves no gap a car or player fits beneath. Landing
  hills ease in (≈0.19 then ≈0.42): a sudden flat→0.4 crease wedged a cased
  monster truck's chassis at speed.
- **Race tunes.** `VehiclePerformance` gains an optional per-model `boost`
  (default `DEFAULT_BOOST` 1.5, the previous shared multiplier). Approved
  original models get faster driven speeds, quicker acceleration and stronger
  boosts, with no catalog or art change:

  | Model | Speed | Boost | Boosted |
  | --- | --- | --- | --- |
  | open-wheel-racer | 240 | 2.25 | 540 |
  | race-coupe | 220 | 2.25 | 495 |
  | rally-hatchback | 200 | 2.25 | 450 |
  | beach-buggy | 180 | 2.25 | 405 |
  | monster-truck | 150 | 2.25 | 338 |
  | go-kart | 160 | 2.0 | 320 |

  Road traffic cruise stays capped at 64px/s, so street traffic is unchanged.
  Engine audio pitch scales with each car's boosted top speed. The lab's vehicle
  menu lists race tunes first; a touch **Boost** button joins Shift/RT.

## Evidence

Headless runs (manual forward + boost, as the lab drives) over all five lanes:
every race tune, `compact-1`, `car-21` and `pickup` on the gentle lanes finish
upright. Peak heights: open-wheel racer 128 (kicker) / 203 (sky); rally
hatchback 110 / 174; compact 57 / 91. The pickup (150 boosted) is too slow for
the sky and double lips and noses over onto its roof; F rights it.
`JumpParkRecipe.test.ts` keeps the rally kicker and cased monster-truck sky runs.
Browser runs in Playwright Chromium against the dev server matched the
headless peaks with no page errors.

## Next

1. Owner/child play review of lip shapes, gaps and boost speeds.
2. Consider gentle airborne pitch levelling if tail-first landings feel harsh;
   that is a shared motor change and needs its own decision.
3. Generated motocross venue: delivered in
   [224](224-generated-motocross-parks.md); a dirt surface type remains.
4. Optional rally/buggy art through art review; streaming check at 540px/s.
