# Startup loading

Topic: startup-loading
Status: visible HTML loading shell and actual startup stages delivered.
Updated: 2026-10-25.

The main page includes its loading UI and styles directly in HTML, before any
application JavaScript or images arrive. A small bootstrap loads the game module
and can show a retryable error if the dependency graph fails. Startup then reports
graphics preparation, saved player/profile loading, local world/server startup
or remote connection, artwork/sound loading, and world preparation.

During asset loading, the existing shared loader reports successfully decoded
image counts against the exact manifests. These are image counts, not download
bytes or a guessed percentage of elapsed startup time. Other stages use an
indeterminate bar. After images finish, the detail notes any remaining sound/tile
work. Asset loading remains parallel, with the same assets and failure policy.
Terrain-only and embedded-lab consumers can omit the callback.

The loading shell stays through startup until a frame has rendered with ready
player terrain/interior geometry, or the usable world menu is drawn. It yields to
interactive profile selection and the existing peer connection/cancel UI. Fatal
startup errors yield to the existing recovery dialog. It does not reappear over
ordinary play, change persistence, or impose new simulation readiness waits.

Implementation: `index.html`, `src/bootstrap.ts`, `src/ui/StartupProgress.ts`,
`main.ts`, `GameClient`, and the optional callback in `GameAssets`.

Validation uses one browser boundary in `tests/smoke.spec.ts`: hold all game
scripts to prove the HTML shell is already visible, hold one image to verify a
real partial count, then release it and observe profile/server/assets/world
stages and readiness dismissal. Production entry/build and the existing launcher
boundary cover the packaged bootstrap path. Startup speed and an overall
byte/time estimate remain separate performance work.
