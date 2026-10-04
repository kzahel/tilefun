# Component family expansion — independent adapter review

Date: 2026-10-04. Scope: the final RB01/E03/A01 family-sheet adapter and
committed catalog, including the separate **Source demonstrations** grouping.
This is an agent review of a bounded source adapter, not human approval,
gameplay validation or a fresh interpretation of the original packs.

**Accept this exact adapter/catalog snapshot.** No blocking pixel, provenance,
record-assignment, recipe or metadata-fidelity defect was found. The three new
sheets expose 46 cards / 59 source records; the complete catalog contains eight
families, 131 cards and 191 distinct source records.

## Reviewed identity

| Artifact | SHA-256 |
| --- | --- |
| `scripts/build-family-expansion.py` | `72c0c2b681bd987537001b5ffec6b4d35a2ef32157387f31f1cef300a322d96e` |
| `public/data/family-sheets.json` file bytes | `e9c8c02d63d898a1846fde4823de249295136ae6e830ab43882263742ea1a8fe` |
| Catalog canonical revision | `e52e627c6da1ab1691708e5fef012f0af545457688c322df9df191f8113ef132` |
| Room Builder family revision | `ea6a039d20fb017dd60ebe33506a835c6ccea6ff7a4dc62a6d729cbfa81f3422` |
| Playground tubes family revision | `f30af146aa7f9ccd15544286a2b18e623d240cb54a3165c666e2db76ad651bf0` |
| Animated doors family revision | `b6049c97c198489e793bf32885dfd7096f6cbb14edf3ed15d6fd132928771d1c` |

Frozen inputs match the previously reviewed packets and receipts:

| Packet | Proposal SHA-256 | Review SHA-256 |
| --- | --- | --- |
| RB01 | `88f2ebcf7f7509e3da1337f9e1bd2dde087f6b342e245f478fb94ddc07b2b6c4` | `31461d71cb25c1fa5eb9c4287dc2df4f2ca491a6e26367a21d69153f22821601` |
| E03 | `4370a63a1308b9ccc844029bfe077bb304faac2e62826923c3ba5a685508143e` | `ab901c1a2859661332b15187060a3c38d3ad1e7d04ed69656128e83f49f8df88` |
| A01 | `f0e5f627c4e8fe27c5de9c83c5b2ba98d60f273fd7361be07a914563a49e9f0c` | `7ee15c2663c88f4e7aded23d9f8023b8fc0203264f77527617fbd265fbfe9dce` |

## Independent pixel and bounds replay

The reviewer ran separate inline Python/Pillow checks that read packet and
catalog JSON directly. Neither `build-family-expansion.py` nor
`build-family-sheets.py` was imported or used to construct expected recipes.
Expected Room Builder frames came from packet packed aliases tied to the primary
source rectangle; expected tube frames came from packet committed master crops;
expected door frames came from their packet source-strip indexes.

All 59 candidate native dimensions, full normalized RGBA hashes and alpha-visible
bounds match. Every catalog member variant has exactly its intended record ID,
source sheet, rectangle, native frame size and `(0, 0)` placement. Counts are:

| Sheet | Cards | Source records |
| --- | ---: | ---: |
| Floors and stone arches | 25 | 25 |
| Playground tubes | 19 | 25 |
| Animated doors | 2 | 9 |

All 58 declared RB01 packed aliases were additionally replayed against the
committed atlas. Their tile/sheet keys and original-source translations agree
with the pinned packed index, whose file hash is
`c2beaba7bbd767b14df8cb7faa042908adbda89e0a43a7fd5c37cb5101a9a02e`.
All 30 declared E03 master occurrences also reproduce their candidate hashes.
This checks declared links, not a newly exhaustive occurrence search.

The four sources used by these new families pass committed PNG file hashes,
dimensions and full normalized RGBA hashes against packet source records:
`modern-interiors`, `me-complete`, `interiors-door-1` and
`interiors-door-1-locked`. Family source pins match their catalog source entries.
Catalog and all family canonical revision hashes independently verify.

Transparent hidden RGB is zeroed only where alpha is zero. Visible RGB and all
alpha values remain unchanged. All layer source rectangles and placements fit
their source images and destination canvases.

## Static assemblies and blend contract

All eight displayed RB01 recipes and five displayed E03 recipes were constructed
independently from packet placements and verified candidate crops, then compared
to both frozen packet output hashes and the catalog raster. Layer order,
translated local crops, record-ID order and native canvas sizes all agree.

RB01 uses unmasked RGBA replacement. E03 uses ordered Pillow `alpha_composite`
and every displayed tube layer explicitly carries `blend: "over"`. Switching
the E03 U recipe to replacement changes **27 visible normalized RGBA pixels**;
the other four tube examples happen to have identical normalized output under
that substitution. Thus the U is the meaningful positive blend discriminator.
Hidden RGB alone must not be counted as a visible blend difference.

| Displayed recipe | Independently reproduced normalized RGBA SHA-256 |
| --- | --- |
| `inset-square-native` | `7d06c476da8634ede8f101a15f05997506be4b4fa0af70c19bfc95d16758e625` |
| `shaded-vertical-0-middle-rows` | `171d08f6c66f2f92dc323373ce650d9b767c0cfeb5de3f46e6639f7261ca1639` |
| `shaded-vertical-1-middle-rows` | `7bb71a74f745e1373b3f2c276a9d724959b411cdbbce3ed7834e4330a89d3acd` |
| `shaded-vertical-2-middle-rows` | `e28043cd555d408af266928ed5b45f4be869d732b242d2643a46b1d2353af119` |
| `stone-arch-body-three-rows` | `d13c8b6e508fe44d56fef2135479b4a2f8e5be1cd88035edcdd7a77052d88107` |
| `stone-arch-with-shadow` | `50a7e43bc9fafa570932f65a13665750dfe9d436b505379fe6e8dfb85db419d2` |
| `L-continuation-window` | `d10326c1ac82b849b53ddbd1f44d3693655642d673159cb00b20d4f4f913c68c` |
| `T-continuation-window` | `6f1a40cedc2d0021e6eebc572cfa2398d82f6f376b2da35c9f5728954bdaa7d5` |
| `straight-two-mouths` | `cb06d1ce184d238bb1f06ba45dff91f04586ac8b5737be1f2fda81d6c110234f` |
| `cross-four-mouths-ochre` | `c76f1ea3f7f5f25317c5c82115ae685f1da1e2d54c8879f77ec185cedd1df353` |
| `u-two-mouths` | `86105631cef9790277e9d3f5ace85e68cf4bc29a26f69ffe26bd64c524c34614` |
| `cross-four-mouths-blue` | `399faee684d645eb923511a2df0891fe3fc8d63c5ad8d4ec33fb49f69ae2b226` |
| `cross-four-mouths-red` | `f1c9d000a9266dd52e330bdf60dbdf48b1d8ffb02e2949d1896ecf3d544cc852` |

## Animation and metadata fidelity

All nine demonstration variants are exact native 16 × 32 source frames, in the
packet's source order, with the same variants used by the two static member
cards. Frame IDs remain separate source records. A01-01 and A01-06 are exactly
equal, giving eight pixel states across nine records without dropping either
source identity.

| Sequence | Companion-GIF durations in source order | Cycle | Demonstration loop |
| --- | --- | ---: | --- |
| Opening | 300, 100, 100, 100, 300 ms | 900 ms | true |
| Closed-door movement | 500, 100, 100, 100 ms | 800 ms | true |

Every duration, decoded frame index, exact frame-ID correspondence and normalized
frame hash agrees with `sourceGifDemonstrations`; the loop flag matches the
packet's GIF loop extension of zero. Timing is checked against frozen packet
evidence; this review does not separately decode the original GIF files.
`gameplayPlayback` fields remain unknown in the packet. Both catalog examples
are grouped under **Source demonstrations**, identify companion-GIF behavior,
and preserve the explicit warning that an opening reset is not a closing
sequence. Static card variants are labelled **Frame** and classified `frame`,
not spatial assembly components.

All RB01 and E03 cards retain component classification and forbidden-standalone
copy. Room Builder preserves six fixed arch-body pieces, two optional shadow
strips, the master/source shadow difference and unresolved inset extensions.
Only the six closed RB examples are in the default group; the two open-boundary
L/T windows explicitly use **Open path sections** and require continued paths.
No invalid/weakened packet probe appears as a supported assembly.

Tube cards retain continuation-neighbor requirements separately from external
mouths, exact duplicate source names, shading exceptions, unresolved rounded
ends/rim purpose and unknown traversal/geometry. Only the crossing and two side
entrance cards have blue/red variants. The five examples contain only frozen
positive same-palette recipes; no general compatibility or mixed-color rule is
invented. All three sheets remain Proposed and grant no runtime placement,
collision or human approval.

## Preservation and limits

The complete objects for cabinets, trees, scrapyard, outdoor seating and sofas
are exactly equal to `HEAD:public/data/family-sheets.json`, including their
revisions, facts, groups, variants and examples. All four preexisting source
entries also match `HEAD` exactly.

Confidence is bounded to this exact committed-source adapter/catalog snapshot
and the declared frozen evidence. No original-pack exhaustive search, missing
source search, arbitrary assembly geometry, actual game animation contract or
human approval was reproduced or inferred. Application rendering and playback
checks are owned by the coordinator's isolated validation; this review ran no
shared npm, build or browser job and changed only this note.

Next: integrate these reviewed records into the continuing semantic map and
present the proposed sheets for exact-source human discussion. Broader floor
extension, tube compatibility and game door behavior still require new work.
