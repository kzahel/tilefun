Classic v1/v2 diagnostic package. Start with report.md and figures/peer-native-identity.png. This is a sealed source-only comparison record, not a rider asset or registration. Source v1/v2 remain in their original directories. There is no v3 support or art here.

From repository root, verify retained files and their source dependencies (889 protected repository inputs plus the immutable canonical CLI, 890 inputs total; retained helper snapshots are pinned by the package manifest):

```sh
python art-source/vehicle-riders/classic-comparison/v1/helpers/verify.py --inputs
```

To reconstruct evidence using the existing revision-aware read-only CLI and exact executed helpers:

```sh
node scripts/vehicle-riders/compare-outline.mjs --revision v1
node scripts/vehicle-riders/compare-outline.mjs --revision v2
blender --background --factory-startup --threads 4 --python-exit-code 1 --python art-source/vehicle-riders/classic-comparison/v1/helpers/peer-geometry.py
node art-source/vehicle-riders/classic-comparison/v1/helpers/peer-eye-probe.mjs v1
node art-source/vehicle-riders/classic-comparison/v1/helpers/peer-eye-probe.mjs v2
python art-source/vehicle-riders/classic-comparison/v1/helpers/peer-analysis.py
```

Use the installed Blender 5.2.2 LTS executable path if `blender` is not on PATH. Observed tools: Python 3.13.14, Pillow 12.2.0, Node 24.18.0 and repository-pinned npm dependencies/bundled full Playwright Chromium. Tool/source hashes and exact Chromium version are in provenance.json and the outline receipts. The helpers use repository root as CWD. They reconstruct compiled viewers, extracted synthetic fixtures, per-pixel traces and captures strictly under ignored data/vehicle-riders/classic-outline-comparison/{v1,v2}; no pre-existing scratch/cache is an input. Each browser runner closes its own bundled Chromium in finally. Comparison builds use isolated cache/watch:null/entries:[]; no installed primary browser is used.

The comparison CLI defaults to v1, accepts only v1|v2 and rejects unknown/incomplete inputs before inventing results. Retained CLI regression records 96 reference RGBA checks plus 256 prior PNG bytes / 128 pair statistics and malformed/incomplete negatives. The incomplete-v2 refusal is historical, before its completed comparison. Reuse the canonical CLI; its SHA is pinned here and it now stays immutable. Do not add v3 to it. Future v3 peer assessment must use a separately named adapter/tool or an ignored probe after runtime source completion. The byte-exact executed snapshot in helpers/compare-outline.mjs also preserves the historical API; it has no script-location-dependent imports.

retained-files.json pins every package file except itself. provenance.json lists source paths/hashes for exact copies, explicitly reduced evidence and all 889 protected source inputs. Scratch paths in historical receipts identify regenerated outputs, not undeclared construction dependencies. identity-landmarks.json retains actual final pixel/semantic measurements; eye-control-results.json retains all 32 actual controls per revision and UV hits while omitting the redundant ray cloud and ambiguous first-match overlapping-chart collar rays. No model, atlas, sprite, fixture, viewer bundle, browser cache or node_modules is duplicated. Source models/approved sprite, semantic masters and shared read-only renderer code remain genuine declared repository inputs.

Fixed density is 80/4.6, native 224 / radius 112. Figures use fixed crops/native and nearest2x, never per-model/per-angle fitting. Original standing hip registration is inferred, not a claim of identical seated projection. Formal human verdict is null. Actual-bike, normal, AI/fallback/all-avatar and production gates stay deferred. Root owns visual judgement and any future fit release.

Scoped read-only Biome passes the canonical CLI and its retained exact copy. The historical executed snapshot `helpers/peer-eye-probe.mjs` is intentionally preserved byte-for-byte. Only that exact path needs a root-owned narrow exemption for `format`, `assist/source/organizeImports`, `lint/suspicious/useIterableCallbackReturn` (line94), and informational `lint/style/useTemplate` (line149). See evidence/scoped-biome.json. No Biome config was changed; this report does not claim repository lint passes. Root owns that exemption and final repository lint.
