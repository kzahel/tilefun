# Sports-car style experiments

Status: four experiments delivered for inspection, 2026-10-19. Owner requested independent YA API Codex
`gpt-6.1-sol` / high / bypass-permissions experiments and a visual comparison.

## Question

Can a detailed authored 3D car become convincing Tilefun pixel art through the
animal/character finishing process, and can those pixels supply a future
sprite-to-low-poly texture workflow?

Compare four original red Italian-style sports cars under one rendering contract:

1. **Detailed shaded render:** smooth, detailed geometry and glossy materials,
   followed by shared-palette reduction, binary alpha and pixel outlines.
2. **Detailed toon render:** similarly detailed geometry with controlled lighting
   bands and material colour roles before the same pixel finishing.
3. **Guide-based pixel finish:** detailed 3D geometry and projected component
   guides, then deliberate pixel clusters for glass, lamps, vents and highlights.
4. **Simple geometry and paint:** low-poly authored body, named surfaces and
   procedural palette-based paint, as a baseline for the added authoring cost.

These are independent authoring trials, not a controlled same-mesh shader study.
Model differences are a confound; a follow-up can cross-render the best mesh.

## Shared brief and evidence

See [the experiment contract](../../scripts/vehicle-style-study/README.md).
Each route owns its own scripts, source scene, renders, eight-direction sprite
sheet, turntable, enlarged contact sheet and machine-readable report. Keep all
previous source vehicles and review snapshots immutable. This is an offline
study; no gameplay or existing bank changes are authorized or required.

The coordinator assembles native-size/enlarged comparisons beside frozen existing
vehicle sprites and inspects actual outputs. Results must distinguish procedural
finishing from hand-authored pixel decisions. Detailed-to-sprite output alone
does not establish a successful low-poly texture reconstruction.

## Delivered comparison

All four YA sessions ran the requested `gpt-6.1-sol`, `on:high` and
`bypassPermissions`. Launch receipts remain in ignored local data; the API's
process records confirmed the exact model and high effort. All four finished
and returned to idle. No additional nested agents or runtime changes were used.

| Route | Evaluated triangles | Final colours | Coordinator visual assessment |
| --- | ---: | ---: | --- |
| Detailed + glossy | 234,036 | 28 | Convincing smooth coupe; glossy reflections turn into conspicuous pale clusters and fine colour noise at native size |
| Detailed + toon | 113,888 | 13 | Clearer red body and a strong silhouette; some rim/vent detail merges, and thick ink/deep shadow still need taste decisions |
| Guides + pixel finish | 71,390 | 16 | Deliberate glass, lamp and vent clusters approach the existing pixel vocabulary; more finishing logic and some heavy wheel/trim accents |
| Simple + painted | 1,710 | 16 | Crisp readable baseline with far less geometry; flatter, more angular panels and simple glass treatment |

The coordinator inspected the four raw diagonal renders, all-direction process
sheets, combined comparison and browser captures. The guide route's first full-width
wheel cutters removed strips of the hood and deck; the agent replaced them with
side-local cutters and regenerated its evidence. Vent speckles were subsequently
replaced with visibility-clipped deterministic cluster rules. Earlier diagnostic
captures remain local; retained evidence represents the corrected final pixels.

The current recommendation is **toon rendering plus selective guide-based pixel
finishing**. This is an agent assessment, not human art approval. Extra geometry
helps coherent curves and future views, while much of its mechanical detail is
lost at this scale. These trials do not isolate polygon count, shader, sampling
or body-design effects; each route independently authored its mesh and finish.

Exact editable sources and guide/inspection receipts are retained in
[`art-source/vehicle-style-study/`](../../art-source/vehicle-style-study/README.md).
Raw renders, sprites, process sheets, reports and turntables are under
`public/demos/vehicle-style-study/`. The shared index is
`public/demos/vehicle-style-study/index.html`; `overview.png` is the static comparison.
`python scripts/vehicle-style-study/assemble.py` validates the outputs and creates
the file-URL-safe local `data/vehicle-style-study/standalone.html` viewer.

Four frozen, excluded Workshop candidates use a dedicated `vehicle-style-study`
batch. Their identities verify all eight raw renders, eight final sprites,
sprite sheet, process sheet, turntable and report. Existing source-bank counts
and approvals remain unchanged. The shared public deployment was checked and
does not yet serve these new files; do not present its SPA fallback as the study.
Local standalone/media delivery is available immediately.

## Validation

- Assembler passed all four routes: binary alpha, padded 128px canvases, eight
  512px raw renders, exact frame/sheet pixel equality, eight-frame GIFs and
  retained editable source scenes. Palette counts come from actual final pixels.
- Isolated bundled full-Chromium capture passed artifact loading, all headings,
  synchronization, raw/final switching, native zoom, play/pause, mobile overflow
  and the standalone file without server access. Captures and result receipt
  are local under `data/vehicle-style-study/gallery-check/`.
- Typechecks and lint passed (existing warnings remain). Art inventory refreshed.
- Workshop manifest rendered and normal-Chromium/retina-verified **1,384**
  candidates. A comparison against the prior committed manifest found exactly
  four new candidates and **zero changed existing candidate records**. Inbox
  shows the new batch's four excluded experiments with no fabricated approvals.
- Production build passed. Focused Workshop/tool/vehicle-review/browser-raster
  checks passed: 56 in the first run, followed by the one tool-index test after
  its expected tool count was updated from 28 to 29. The new gallery destination
  is included in its served-destinations check.
- Full unit run: **4,378 passed, 6 failed, 10 skipped** across 306 files. Windows
  file-symlink creation returned EPERM in FsSecurity/privateDataPlugin/staticFiles
  fixtures; the interrupted SQLite child expects POSIX SIGKILL semantics.
  WorkshopService also hit test/cleanup timeouts during the full run, but the
  isolated failing case passed afterward. These persistence/platform tests were
  not changed for this art study.
- Full Playwright collection was blocked by the missing installed `peer`
  dependency imported by the two existing P2P suites. The focused run above
  avoids those collection blockers; no claim of a passing full suite is made.
  Full logs remain under ignored `data/vehicle-style-study/`.

## Next work

Choose a preferred body/style, then compare toon and guide finishing on that
**same mesh** with matched lights and sampling. Feed its four cardinal output
sprites into a fresh low-poly fitting/UV-projection pilot and inspect diagonals.
That round trip is still untested: good generated sprites alone do not establish
good reconstructed textures, hidden surfaces or continuous runtime rotations.
Human art acceptance remains separate.
