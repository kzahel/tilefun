# E04 / I02 / E05 model and assignment adapters

The explicit adapters add 64 source records and 52 proposal units: E04 plants and
planters 19/19, I02 bedroom 18/6, and E05 fences and garden gates 27/27. Combined
with the previous packets, the model contains 255 records / 216 units. Source
records, proposal units, distinct pixel states, presentation cards and finite
recipe examples remain different quantities. Registration alone earns no credit.

All previous 191 source records, 164 proposals, 156 relationships and eight
reviews are unchanged as complete JSON objects. The new model adapter preserves
the exact frozen candidate evidence, complete fields/topology, aliases, matching
receipts, alternatives, experiments, duplicate groups and per-record/per-probe
independent dispositions. Human approval and gameplay geometry remain unknown.

## Frozen evidence

| Packet | Proposal SHA-256 | Independent review SHA-256 |
| --- | --- | --- |
| E04 | `8fbca92889dd7bc587093eaa38d276b36d6ccbe22a8f748c79d4b4f6c4554f36` | `7815d8d76dfa2543f5ee43f10d9da5ff375a02043574a8bcd2474e7a508ea961` |
| I02 | `9b951c075c0707f86391b14741f533c499a8b1938342db936e0b9dea29f7e0a5` | `fb62ea277d4c053acf5ba752dd2da54963c55e30a8920425c1cb050e5f0efc88` |
| E05 | `238778d9b00baadfa7de2799b3d55a0f834be22237b0994c77e731efba1e2870` | `3395feed2cfe2f9e505c9ca375b2792b22519c95f078d0ab58d92bb0663191e8` |

The mapping helpers and matcher dependencies are also pinned by the model.
Independent review is scoped to these exact proposals and membership; it is not
owner approval. E04 owner planter selections are identity clues only.

## Pixel and lineage contract

E04 has 16 exact native whole frames in the Exteriors master and three
`alpha-visible-reconstruction` records. For E04-03, E04-04 and E04-15, foreign
pixels in the master's native-frame padding prevent whole-frame equality. The
committed rendering contains an exact visible crop with an explicit transparent
native frame restoration. Its source rectangle, original frame dimensions and
copy offset are retained separately. Pixel validation uses unscaled RGBA copy
without an alpha mask; fully transparent RGB is normalized to zero while
visible/translucent RGBA is preserved. These records earn no whole-master-frame
credit. Visible correspondences provide navigation context only.

I02 has six exact cover records in the Interiors master and 12 bed records with
`subfile-only` lineage. Every record has an exact committed packed-atlas replay
with original export correspondence. Black-shadow exports retain their actual
vendor indices rather than inheriting normal filenames. Duplicate cover exports
remain six records with two distinct master locations. They do not increase the
number of logical bedroom units: six units retain their three render variants.
Packed crops are not original master occurrences.

E05 has 27 exact master source records and 23 distinct pixel states. Its 22
pickets are component proposals; four garden gates remain unresolved proposals
with unknown standalone eligibility; Bush6 is a whole visual object. All native
master matches, aliases and duplicate exports are retained. Neither pixel
identity nor a gate label establishes shrub/gate seam compatibility.

The assignment ledger counts the new master lineage as 49 exact-direct, three
alpha-visible reconstructions and 12 subfile-only records. Committed render
references and 38 alpha-visible correspondences are reported separately from
whole-frame credit. All source groups and surveyed regions remain partially
investigated; there is no exhaustive semantic completion denominator.

## Replay and limitations

The adapter replays positive source occurrences and visible crop correspondences,
exact native RGBA/alpha bounds, packed alias catalogs, 17 I02 source-over probes
and 14 E05 source-over probes. It validates cover/bed ordering, variant and
underlay offset for the bounded I02 recipes. E05 additionally replays the saved
port profiles/origins and seam pixel diagnostics. Negative, weakened and unknown
examples retain their dispositions; a reproducible raster alone does not make a
recipe valid. No arbitrary assembly validator or gameplay rule is inferred.

E04 crown/pot comparisons, padding adversaries and owner selection correspondence,
I02 shadow-token/body deltas, wrong-number filename refutations and contextual
master differences, and E05 pixel duplicate/comparison claims are replayed.
The frozen absence-search receipts remain evidence; checks and mutation tests do
not rerun the full grid/alias absence searches. I02's bounded 130-member black
shadow counterpart pool is rechecked only when its pinned originals are present.

`--committed-only` permits absent ignored originals and reproduces all 64 new
native record frames and all 31 finite probe rasters from committed PNGs. It
separately reports unavailable original frame evidence, original visible/theme
correspondences, I02 filename/master comparisons and counterpart uniqueness.
Present files with drifting hashes always fail, even in committed-only mode.
This fallback does not claim that absent original bytes were verified. The
coverage ledger uses committed frozen evidence and cannot independently verify
ignored original PNG bytes.

## Validation

Run the focused scripts from the repository root:

```sh
python3 scripts/semantic-map-model.py --check
python3 scripts/semantic-map-model.py --check --committed-only
python3 scripts/semantic-map-model.test.py
python3 scripts/semantic-map-next-families.test.py
python3 scripts/semantic-map-coverage.py --check
python3 scripts/semantic-map-coverage.test.py
```

The adapter checks fail closed on source/packet/review/helper hash drift, source
coordinates and alpha bounds, typed padding offsets, wrong counterpart indices,
finite source-over recipes and explicit registry/model membership. The original
normalized object arrays are guarded by frozen regression hashes. Application,
family-sheet and browser checks are coordinated separately by the root agent.

Next: independent implementation review of these exact normalized adapters and
ledger, then coordinator reconciliation. Further plant families or garden-gate
connections need separate bounded source evidence and review.
