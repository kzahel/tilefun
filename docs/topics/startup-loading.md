# Startup loading

Topic: startup-loading
Status: visible HTML loading shell and actual startup stages delivered.
Updated: 2026-11-18.

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

The main game starts the shared 3D scene import alongside asset preparation.
The sprite catalogs build their grids and previews when opened, including when
a startup link opens a catalog directly.

Gameplay loads lossless WebP copies of the two large atlases. The committed PNGs
remain the source for the exact review and terrain-only tools. Asset generation
checks every decoded RGBA pixel before recording the two formats' hashes. The
build verifies those hashes. The gameplay loader keeps straight alpha during
WebP decoding. Chromium composited both copies pixel-for-pixel against the
original PNG loading path.

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
boundary cover the packaged bootstrap path.

## Startup timing (2026-11-17)

Three runs per configuration used full headless Chromium on the development Mac
at 1280 × 900. Each run opened a fresh single-player profile over loopback and
reloaded it. Times are median navigation-to-loading-shell-dismissal, excluding
any save before navigation.

| Configuration | Cold | Reload |
| --- | ---: | ---: |
| Vite before the unified top-down default (`ae8ec0d7`) | 2.57 s | 2.29 s |
| Vite after renderer retirement (`acf534f0`) | 2.38 s | 2.17 s |
| Vite with scene preload and on-open catalog work | 1.82 s | 1.58 s |
| Production preview before the startup changes | 2.61 s | 2.11 s |
| Production preview with the startup changes | 1.75 s | 1.41 s |

Loopback times were similar before and after the renderer transition. The CPU
profile attributed about 340 ms to drawing hidden interior previews, and the
unified view imported its scene after the image stage. The ordinary cold Vite
page previously transferred about 75 MiB in this lane, compared with 32 MiB in
production preview.
The interiors atlas (12 MiB), exterior atlas (6.8 MiB) and interiors index
(6.8 MiB) account for most of the production transfer.

Cold Chromium over the public HTTPS development route was still on **Loading
game code** after 40 s, with Vite's 10 MiB Rapier module outstanding. The proxy now
compresses startup JavaScript and JSON with gzip or Zstandard. The interiors
index dropped from 7.16 MB to 222 KB with gzip. Vite now serves Rapier's own
browser ESM, which avoids the optimizer's duplicate Wasm in the inlined map.
Chromium transferred about 2.0 MB for Rapier with Zstandard and reused the
cached response in the authority Worker.

With compression and that module change, public HTTPS reached artwork at 15.3 s
in one cold run and finished at 85.3 s. The 12.6 MB interiors PNG was the last
image and took roughly 70 s from request to completion. The gameplay WebP copies
reduce the two atlas transfers from 19.7 MB to 4.0 MB in total. A subsequent
public HTTPS run reached play in 29.8 s cold and 26.9 s on reload. The reload
transferred about 425 KB across the many revalidated development requests.
With the same HTTPS origin pointed directly at the proxy over LAN, three paired
runs had medians of 2.85 s cold and 1.66 s on reload. Bundled delivery would
reduce request round trips on the public path.

## Versioned assets in Vite development (2026-11-18)

The play bootstrap fetches a revalidated manifest alongside the game module
graph. It contains the content hashes of the startup images, sounds and two
atlas indexes. The game uses these hashes in the asset URLs. Vite serves the
matching bytes with a one-year immutable cache policy. A new asset edit gets
a new URL on the next navigation, alongside any unchanged cached assets.
Assets use their ordinary URLs if the manifest is unavailable or if a file
changes between the manifest and the asset request. Development modules keep
Vite's normal validation, and the player still chooses **Save and reload**.

A cold and reload pair through live public HTTPS reached play in 29.7 s and
11.3 s. Cold time was comparable to the previous 29.8 s. On reload, Chromium
reused all 474 versioned assets from cache, and the artwork stage took 0.94 s
compared with 15.5 s in the earlier HTTPS run. The full reload previously took
26.9 s. On the direct LAN HTTPS route, three paired runs had reload medians of
1.51 s before and 1.70 s after. The cache eliminated roughly 470 network
operations per reload on that route, where request latency is already low.

The HTTP integration test verifies immutable responses, manifest revalidation,
new hashes after a same-size edit, and rejection of stale versions and escaped
symlinks. The public HTTPS trace verifies browser cache reuse.
