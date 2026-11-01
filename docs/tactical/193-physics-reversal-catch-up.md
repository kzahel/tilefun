# Bounded correction catch-up for quick reversals

Status: delivered and validated for inspection, 2026-11-01. Owner reports steady movement improved after
[192](192-physics-correction-presentation.md), but quick left/right reversal still
looks like a teleport. Owner confirmed this affects the observing pane. [Physics engine](../topics/physics-engine.md) owns direction.

## Reproduction and cause

Native manual traces exercise either controlled seat, horizontal and depth-axis
reversals, a nearby cube and the lift. They reproduce 25.7 cm displayed steps near
the cube and 40.5 cm near the lift in the delayed guest view. Raw physics corrections
can reach 2.6 m when a held-input guess reverses direction. No history recovery
occurs. Far-away buffered movement remains about 7.5 cm per 60 Hz sample.

The 120 ms exponential display-offset decay in 192 has no velocity bound. It
releases more distance per tick when the remaining error is larger. Consequently,
a continuous correction can still look like a lunge after rapid direction changes.
This is separate from a raw physics teleport, an explicit history fence or the
existing 4 m offset-reset threshold.

The display now limits the correction component to **4.5 m/s**, independently of
normal physical movement. One shared decay fraction is selected from the largest
body offset, bounding every member while retaining the group's relative correction
path. Small corrections retain exponential decay; large ones take longer to settle.
Rotation follows the same group fraction. Normal subsequent movement still applies
its full delta. No inputs, collision rules, replay policy, networking or authority
state change. Raw comparison and existing reset fences remain available.

The lab exposes maximum correction-release speed in m/s alongside raw rebase,
display offset and actual rendered-step diagnostics. This is the additional display
catch-up component, not a total gameplay speed limit.

## Shared scenario and evidence

**Quick left / right** approaches the cube, taps left for four ticks and returns
right, repeating three times before stopping. The native and interactive labs use
the same tick-addressed input script. Tests also drive the sequence through either
control seat, including the guest's larger input lead.

- 51 focused native tests pass across physics/replay/presentation, both control
  seats, bounded Worker channels, authority clock and scenario host.
- A new pure regression bounds each correction-only display increment, verifies
  group correction ratios and confirms that normal new movement is not filtered.
  It fails under the preceding unbounded exponential policy.
- Repeating the manual traces reduces the cube case from 25.7 to 15.0 cm maximum
  displayed step and the lift case from 40.5 to 15.6 cm. Physical input/state
  behavior is unaffected; unknown-input rebase distances remain measurable.
- `npx tsx scripts/benchmark-physics-presentation.ts --output=docs/benchmarks/193-physics-reversals.json`
  now also includes the shared reversal script. It records 2.101 m maximum raw
  current-pose correction in the guest; maximum remote step is 2.026 m in raw mode
  and 0.150 m in either smoothed mode. Final authority physics hashes match across
  all three presentation policies for each recorded scene. These are accelerated
  native samples, not browser/GPU/Chromebook performance measurements.

- The production two-client Chromium case now runs the complete reversal script
  from a paused tick-zero scene before capturing it. The earlier test could accept
  the preceding scene's tick count during reset; explicit reset fences also cover
  the lift and start/stop scene changes. The tightened two-client case passes,
  alongside both original bridge/support/stall browser cases on identical final
  runtime code. Keyboard, touch, controller, modes and teardown remain covered.
- The inspected full-reversal capture reaches authority tick 227. Guest maximum
  raw current-pose correction is 210.11 cm, displayed frame step 15.01 cm and added
  correction release 4.50 m/s, with zero late inputs/recoveries. Both actors have
  returned to the predicted contact timeline and display offsets have settled to
  zero. Coordinator-step p95 is 2.20 ms in this desktop observation; no GPU or
  Chromebook headroom claim is made.
- Three-project typechecks, focused lint, whitespace checks and production build
  pass. Regenerated review inventories verify 2,119 identities in normal Chromium
  at retina scale (137 exclusions). Only the excluded physics identity and source
  digest change; all authority Workers retain their preceding runtime hashes and
  sizes. The experimental page chunk is 4,389.99 kB / 1,688.22 kB gzip.
- All six normal-game streaming readiness stages pass with zero missing-data
  frames, final missing data and incomplete caches. Browser validation uses
  isolated auth/data and bundled Chromium; no user world or primary browser is
  opened. Whole-repository suites were not rerun.

## Limits and next

This reduces the visible lunge; remote input guesses can still be wrong. Larger
display offsets now converge more slowly and can temporarily offset visible
contacts. Discontinuous reset fences, corrections over the existing offset bound
and low render cadence are separate limits. Ordinary game presentation, independent
client/server clocks and actual Chromebook/WebRTC qualification remain later work.

Inspect quick reversals near the cube and shared lift, then qualify independent
clocks and target-device pacing before tuning prediction lead or remote input
forwarding. Those change latency/correction causes rather than this display-only
catch-up policy.
