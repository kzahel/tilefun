# Horse anatomy and motion study

Owner authorization: 2026-10-18, “Proceed” to a horse-first clay prototype after
rejecting the frozen body and disconnected, spider-like legs in the existing
horse/giraffe previews.

Scope: one horse clay study, current `horse/motion-study-v3`; slow true-side diagnostic,
matching world travel and all four unchanged game-camera projections. Reuse
the existing body/head appearance to isolate the motion issue. Rebuild the
leg articulation inside the shoulder/haunch, distinguish elbow/carpus from
stifle/hock, carry those joints with torso weight transfer, keep segment lengths
fixed and support hooves grounded. The side camera is diagnostic only.

This is a pending clay study, not replacement game art or human approval.
Do not change immutable `draft-v1`, giraffe, historical sheep/piglet coordinator
prototype gates or the broader production hold.

## Implementation and evidence

The Blender source has 32 poses over a 1.6-second lateral four-beat walk.
Stance lasts 66% of a stride; matching root travel is 1.44 world units/cycle.
Loaded forelegs have small carpal flexion; the hind hock retains its separate
bend. A composite-chain solve constrains those angles before solving the upper
articulation, avoiding the deeply folded supporting knees of the first study
iteration. Torso rise, pitch and lateral transfer drive the hip/shoulder anchors.
The head follows softly. No mesh scaling or rendered-image bob is used.

Independent saved-scene audit: 2,112 fixed-length checks, 364 grounded contacts,
336 consecutive planted travel pairs, closed loop, constant local geometry and
no scale tracks. Native torso vertical ranges are 1.1491px down/up and 1.4628px
left/right. Maximum contact drift is under 0.000001 world units. These checks
verify mechanics; they do not certify visual believability.

- [Source and reproduction](../../art-source/wildlife-v2/horse/motion-study-v3/README.md)
- [Local interactive player](../../public/demos/wildlife-v2/horse/motion-study-v3/index.html)
- [Slow side animation](../../public/demos/wildlife-v2/horse/motion-study-v3/side-slow.gif)
- [Travel animation](../../public/demos/wildlife-v2/horse/motion-study-v3/travel-slow.gif)

The first study remains immutable. A final source check found Euler wrapping
between valid exported poses; v2 corrects the continuous Blender action with a
consistent anatomical frame and compatible quaternion keys. All 65 half-pose
samples keep endpoint differences under 0.002 world units (0.02 native pixels),
with a maximum half-pose rotation step of 5.87 degrees.
V3 widens the diagnostic travel camera so its ear tips have a margin in every
pose; all 224 actual renders pass transparent-margin checks. Native game
projection and geometry/motion are unchanged from v2.

The exact registered player bytes are preserved with a scoped Biome formatter
exception, matching the existing immutable panther-player precedent. The two
standalone players also retain their original button markup (no enclosing form),
with only `useButtonType` disabled for those archived files. Future revisions
should be formatted and linted with VCS ignore processing disabled before
registration, since ignored draft players were skipped by the initial check.

## Validation and handoff

Current review identity: `horse-motion-study-v3`, registered in
`wildlife-v2-horse-motion-139`. V1/v2 stay archived; inspect v3. All three
receipts and both registry mirrors match their exact bytes. The global inbox
lists the zero-event batch, with no human approvals or pending fixes.

- Saved-scene mechanics, 65 continuous samples and all 224 render margins pass.
- Bundled full Chromium checks all 96 chronological side/travel frames and 384
  exact native crops; pause, next pose, keyboard scrubbing, view and speed work.
- Typecheck, lint and build pass. Lint retains 119 existing warnings/34 infos.
- Art catalog and Workshop manifest regenerated; all 883 candidate identities
  match normal Chromium at retina scale.
- Bounded full unit run: 2,820 passed, 5 known Windows failures, 10 skipped.
  An initial unrestricted run had additional timeouts while review inputs were
  changing; the final bounded run restores the established baseline. The final
  registry also passes all 15 wildlife-review/Workshop-service tests.
- Broad Playwright run: 44 passed, then the existing GPU city-train reload
  displacement failure (231px against a 192px limit); max-failures stopped the
  remaining run with one test interrupted. This is not a green full browser suite.

Next: owner inspection of the horse motion before art finishing or a
proportion-specific giraffe study. Existing game art and historical holds remain.

## Authorized completion — 2026-10-18

The owner accepted the displayed horse study: “Looks fine proceed. I trust u.
Complete both. Commit”. This supersedes the prototype-only scope above for the
two named animals only. Finish and activate new horse/giraffe revisions; preserve
every old bank and other species' historical gates. The final pixels get distinct
pending review identities rather than an invented Workshop approval.

Both new `motion-v2` banks retain their existing coat/face palette masters and
physical sizes. Painted body/head planes follow evaluated source transforms;
legs, tail and ears follow independent evaluated joints. No whole-sprite bob or
animated mesh scaling is used. The horse uses a 32-pose four-beat walk; giraffe
keeps paired lateral footfalls and longer segment proportions. The native torso
paint moves at least 2px in each facing. Root stride now matches normal game
speed exactly, also preserving proportional flee/ride timing.

Source audits pass 2,112 fixed-length checks per animal, 364/332 grounded
contacts and 336/304 planted travel pairs. All 65 continuous samples per facing
pass, with endpoint differences below 0.0043 world units (0.043 native pixels)
and no rotation wrapping. Full-Chromium players verify 164 crops per animal at
both native and 3× scales. Source replay reproduces ten render/metadata/audit
artifacts per animal byte-for-byte. New exact pending reviews are registered in
`wildlife-v2-long-legged-139`; the inbox discovers both with no synthetic votes.

The shared `Fauna` profiles now select the completed banks, 32 walk/flee poses
and action start 33. The existing bank/timing regression also checks normal
velocity against the authored root stride for these two animals. Existing
physical bounds, move speeds, mount rules and original bank files are unchanged.

Completion checks: typecheck, lint and build pass; 885 Workshop identities match
full Chromium at retina scale. Full bounded unit run: 2,820 pass, the same five
Windows symlink/WAL failures and ten skips. Eight focused full-Chromium tests
pass: four Canvas/GPU game/lab walk-contact-pause-reload cases, two harmless
ball escapes and two main-game horse mounting/riding/dismounting cases. The
broader browser run passes 45 tests, then stops at the same GPU city-train reload
distance assertion recorded above. One in-flight deer test is interrupted and
649 do not run under `--max-failures=1`; this remains an incomplete full-suite
result, not a green browser suite. All prior pets/predators/fierce receipts and
the three exact horse-study archives still verify. The production table records
both completed banks as game-active. Next is ordinary play inspection of the
finished motion; other species' repair holds remain.
