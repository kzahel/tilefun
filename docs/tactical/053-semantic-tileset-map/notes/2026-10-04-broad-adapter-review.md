# Broad first-pass adapter — targeted review

2026-10-04. **No blocking finding in the reviewed code and sampled B02/B03 art.**
This is a light targeted audit under the owner's broader, plausible-first-pass
policy, not an exhaustive semantic review or human approval. B01 labels were not
reviewed here because this reviewer mapped them. Builds/browser validation remain
with the coordinator.

Read `build-family-broad.py`, its seven contract tests, and the shared
`render`/`check_pixels`/`family` helpers. Public source bytes and index bytes are
pinned; rendering checks integer source/destination bounds, native frame sizes
and normalized RGBA. Native frames use replacement-copy without an alpha mask;
finite examples explicitly use ordered source-over. Interiors packed keys must
retain the indexed rectangle, original export path and native size even when
another alias has identical pixels. Record IDs are unique; card membership is
exactly once, variant IDs are nonempty/unique, groups are present/nonempty, and
card/record standalone roles agree. Required neighbors and semantic uncertainty
survive into plain card facts; unknown roles remain visibly uncertain. Family
output stays Proposed. Street original provenance rests on frozen packet/source
pins and mapper evidence; this adapter does not newly compare ignored originals.

Inspected B02's numbered music overview and piano, screens, table-games and
television-cabinet captures. Upright/grand pianos, benches, game/media hardware
and table-game props form coherent clusters. Cropped TV-cabinet and billiard
halves remain forbidden standalone pieces; ambiguous small/tall panels remain
unknown. The depicted TV-cabinet composition looks coherent. This audit did not
independently replay all source exports or all assembly variants.

Inspected B03's first card overview, utility-pole context, ornamental-signal
context and final utilities/barriers page, with the corresponding sampled
metadata. Complete signals and poles are distinguished from loose heads,
hanging plates and rail sections. The pole with cropped wire continuation is
unknown; rail sections require neighbors. Tiny pictograms, attachment offsets,
cross-design fitting, legal meanings, wire networks and signal behavior retain
explicit limits. No sampled cluster or asserted general join needs a blocking
correction. Honest identity/facing uncertainty remains suitable for owner review.

`python3 scripts/build-family-broad.test.py`: **7 tests passed in 0.012s**.
No new test matrix, corpus search, source matching or shared implementation edit.

Reviewed snapshots (SHA-256):

- Adapter: `e568bd38d3fc23bdbc2fa9ed7b0140cd842a748083308444cee92b6e113ce625`
- Tests: `55a2a6dcf8b8608a6e2f8f1a80e6a7cc30957d4818540ebbbcf097c2c6ac887d`
- B02 JSON: `06f9479b31402f287dacce314b94dd02bf145e1567a5be80c4286594ff322368`
- B03 JSON: `57118aa460faca9f120dc42398eb8e15bbdf2ef56deb3f9c5a0f527ea7f0c063`

The coordinator populated the three final packet pins during this audit. Checked
all three hashes and confirmed the adapter differs from the initially reviewed
body only by that pin assignment. Frozen packet changes now fail `read_packets`.
