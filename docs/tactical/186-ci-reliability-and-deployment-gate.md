# 186 — CI reliability and deployment gate

Status: implemented and locally qualified · 2026-10-23. Hosted run pending push.
Owner: [testing](../topics/testing.md).

The user authorizes the CI repair and proposed smaller deployment gate after
reviewing run [39856692538](https://github.com/kzahel/tilefun/actions/runs/39856692538).
That run took 38 minutes and about 154 runner-minutes. All 6,721 native cases,
11 Worker cases, lint, types and registered rasters passed. The dependency audit
failed, as did four browser shards; deployment was skipped.

## Work

- Patch Vite/Vitest within their existing major/minor ranges; keep the high
  severity audit gate and run both audits before the long native suite.
- Repair the door test's held-input overshoot before its manual action, withdraw
  the player before checking deer recovery, and fence the real Worker during
  animation pixel capture so slow GPU screenshots do not invalidate samples.
- Investigate the truck-bed cargo mismatch with native and actual browser
  evidence; preserve the shared action, persistence and renderer assertions.
- The full local run exposed the transporter taking an exact coordinate sample
  immediately after clicking Pause, before the real Worker pause acknowledgement.
  Await its clock fence and reload completion; retain the three-decimal coordinate
  assertion and all mesh/fallback checks.
- Keep all native/HTTP tests, build and raster checks on pushes/PRs. Select 27
  existing browser cases in one smoke runner, retaining keyboard, controller,
  touch, Worker/save, driving, multiplayer and launcher boundaries.
- Run the full suite nightly at 02:17 UTC and via workflow_dispatch, using the
  existing eight shards. Collect all full-suite failures and retain traces.
- Cancel superseded runs per event/ref; scheduled/manual runs never deploy.
- The generated depot native integration test exceeded the default five-second
  deadline in the previous run; give that existing bounded simulation its own
  30-second allowance, without changing global test deadlines.
- The previous run also exhausted the comprehensive controller-menu flow's
  60-second deadline. Each pad press observes six actual render frames; give
  only that multi-view flow 120 seconds in software-rendered CI (local budget
  remains 30 seconds), preserving every per-assertion deadline and focus check.
- Preserve the exact pre-upgrade `package.json` and `package-lock.json` from
  `66263da7` in the existing historical replay catalog. Vehicle receipts pin
  those bytes; source/runtime receipts and promoted pixels stay byte-identical.

## Native timing

The old run's longest files were Fauna (972.8 seconds), WaterFauna (242.1),
OriginalVehicles (216.0), NaturalHunters (103.0), TrafficJourney (97.5), and
MallardResidency (90.9). Fauna contains 1,013 cases; most cost comes from repeated
regional habitat construction/cache sweeps and 750-step production Realm samples
for each land profile. This is independent of browser sharding. Measure fixture
reuse or distributing that file before changing semantic coverage or adding CI
infrastructure.

A focused inspector profile of the existing 750-step fox Realm sample took
1.705 seconds locally (no assertion loop, concurrent validation load). About
40% of CPU samples were in `InterestManager.demand`; `RealmStreaming` pump/update
accounted for another 6.7%. This points to repeated interest/streaming work in
these long production samples, rather than test discovery. Treat this as
attribution, not a hosted speed estimate. Any engine optimization must preserve
the fresh demand-map/value contract and pass streaming validation separately.

## Validation

- `npm run typecheck`, `npm run check`, production build and `actionlint`: pass.
  Lint retains its existing 121 warnings and 42 informational diagnostics.
- Fresh `npm test`: 6,721 native cases across 374 files and the browser-free
  comparator pass. Native run: 563.4 seconds locally; this is not a hosted speed
  comparison. The first run exposed the unregistered historical lock input;
  retained exact snapshots fix it, including all 33 focused mesh decode cases.
- `npm run check:worker`: 11 tests and deployment dry build pass.
- Both high-severity dependency audits: zero vulnerabilities.
- HTTP/WS integration: 3/3 pass. Replay resolver controls: 16/16 pass.
- `CI=1 npm run test:smoke`: 27/27 pass in 3.1 minutes locally.
  After the scoped controller deadline change, that multi-view case also passes
  separately with CI settings (13.8 seconds; 16.4 seconds including setup).
- Raster verification: all 1,980 registered identities match in headless-shell
  and full Chromium; no manifest or approved pixels are rewritten.
- Original affected browser files: 12/12 pass locally before test changes.
  Truck-bed also passes with forced SwiftShader (18.8 seconds); its hosted cargo
  failure has not reproduced. Retain failure traces rather than change gameplay
  speculatively. Artificial full-world SwiftShader startup exceeds some existing
  five-second startup assertions, so it is not a clean substitute for hosted CI.
- Full browser run: 835/836 pass in 39.6 minutes, with only the newly exposed
  transporter pause/reload race failing. After the fence correction, that case
  passes three consecutive single-worker runs with CI settings (40.8 seconds
  total), keeping
  exact position and all renderer/fallback assertions. The doorway, deer,
  animation-pixel and truck-bed cases pass in the full run. All 836 distinct
  browser cases are qualified across the full run and focused correction.
- Current inventory verification passes: 836 browser cases, one browser-free
  comparator, three HTTP/WS integrations and six opt-in captures. This repair
  adds no cases; refreshing the inventory also records the prior 184 addition.
- Hosted validation requires a pushed revision. The first hosted push run and
  first nightly full run remain the next acceptance checkpoints.
