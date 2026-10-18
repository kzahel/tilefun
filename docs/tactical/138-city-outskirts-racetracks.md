# City outskirts racetracks

Owner request: a large round racetrack outside big cities, with cars racing and
spectators or other appropriate props. Implement, commit and push.

## Delivered behavior

- Current regional cities gain an independently addressed speedway to their east,
  or west when the eastern venue conflicts with an intercity road or railway.
  Villages do not gain tracks. A city with no clear side keeps its infrastructure.
- The 128×104-tile venue contains a stadium oval with 48-tile straights and
  semicircular ends. The asphalt has red/white kerbs, a dashed lane separator and
  a checkered start line. A short paved approach connects the spectator plaza to
  the outer city boulevard while preserving its full driving width.
- Eight existing sports cars run clockwise on two separate rings at 126 and
  150 world pixels/second. The closed graph cannot route ordinary road traffic
  into the race. Both rings use normal TrafficSystem braking, body collision,
  roof support, player driving and durable traffic records. Racers stop for
  people and terrain edits; this is a harmless ambient race, without lap UI.
  Player-driven cars stay where they are parked on the circuit; road-merge
  connectors cannot cut across its curves or grassy infield. Tangent joins finish
  within the same tick so saved progress is valid even at a segment boundary.
- Twenty-four durable spectators mill beside three rows of benches. Lamps, bins,
  umbrellas and picnic tables furnish the grounds, using existing game assets.
- The venue and access reserve dry, level ground before farms and natural cover
  are admitted. Forests, ponds and wildlife homes cannot occupy the venue.
  Chunk seams, stable IDs and query order remain deterministic. There is no
  generator-version bump or rewrite of previously saved development terrain.

## Inspection and review

The World Geometry scene selector includes **City outskirts · oval speedway**.
It uses the actual regional generator and shared Worker Realm, traffic population,
presentation host and save/reload. Its overview frames the complete venue; zoom in
or walk to inspect people and vehicles. GPU with vehicle meshes is the default;
explicit Canvas/GPU sprite selections remain supported.

Seed 2026, owner (0,0): track center **462,455**, spectator arrival **462,492**.
The explorer's Play here handoff creates an ordinary game at the same location.
The four landscape-profile candidates are registered under `natural-landscapes`;
they are pending human review. No approvals or promoted asset banks changed.

## Validation

Focused tests cover deterministic
placement, road separation, lane connectivity and full native car footprints,
dry terrain and seams, natural-cover exclusion, eight-car multi-lap simulation,
roof riding, collision yielding, valid saved progress on every tick, parked-car
restoration, and preservation of the city-road
access junction. Browser checks cover real Canvas/GPU presentation, moving cars,
spectators, paused save/reload and the ordinary fresh-world path.

- Typechecks, lint and production build pass. Lint retains the existing 119
  warnings / 34 infos. Catalog and manifest are regenerated; all 843 candidate
  identities verify in normal Chromium at retina scale.
- The full browser suite passes **664/664** (29.7 minutes). After the final
  parked-car guard, source-dependency bookkeeping and integration of concurrent
  upstream work through `80350b1`, all **22 affected browser checks** pass again:
  racetracks, player driving, predator origins/gameplay and entity previews.
- Final combined-head unit suite: **2,749 passed across 277 files**.
- Three seeds across 75 regional owners admit tracks at all 13 sampled cities;
  one uses the western fallback. Villages remain unchanged.
- Final isolated Canvas streaming readiness passes all six samples (cold,
  standing, walking, sprinting, reversing and zoom-out), with no errors/failures,
  missing-data frames, incomplete-cache frames or stale-cache frames. This is
  readiness evidence, not a physical-device frame-pacing claim. Local evidence:
  [report](/tmp/tilefun-racetrack-streaming-combined/report.json),
  [full browser log](/tmp/tilefun-racetrack-e2e.log),
  [combined browser log](/tmp/tilefun-racetrack-combined-browser.log),
  [Canvas capture](/tmp/tilefun-racetrack-canvas.png),
  [GPU capture](/tmp/tilefun-racetrack-gpu.png).

Next: playtest the venue scale, racing speeds and spectator composition in a
fresh regional world; review the registered composition before any art promotion.
