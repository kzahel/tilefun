# Semantic mapping investigation packets

The coordinator creates bounded assignments from the [queue](../queue.md) using
the [packet template](../packet-template.md).
Name each file `PACKET_ID-short-name.md` and give each worker an explicit output
path. Keep review artifacts separate when two workers contribute to one packet;
the coordinator reconciles them after both have finished.

Link durable evidence and related dated notes from the packet. Exact source
hashes and coordinates must accompany interpretations so another session can
reproduce the investigation.

## Whole-sheet reconnaissance

| Packet | Source scope | Current disposition |
| --- | --- | --- |
| [S02 Exteriors](S02-exteriors-survey.md) · [regions](S02-exteriors-regions.json) | Full 2816×8224 master, including lower extensions | [Independent review](S02-exteriors-review.md): 45 themes, 10 pilot windows and 40 residual windows; four semantic corrections adopted |
| [S02 Interiors](S02-interiors-survey.md) · [regions](S02-interiors-regions.json) | Full 256×17024 Interiors and 1216×1808 Room Builder masters | [Independent review](S02-interiors-review.md) supports all 68 windows with survey-level qualifications |

These are navigational hypotheses, not completed object segmentation. Region
coverage and source-pixel accounting do not measure semantic accuracy or approval.
The queue tracks tree, scrapyard and cabinet trials separately.

## Contrasting trials

| Packet | Scope | Review |
| --- | --- | --- |
| [P01 Trees](P01-trees.md) · [JSON](P01-trees.json) | 12 named trees, eight replacement strips, nine forest parts | [Independent review](P01-trees-review.md): 29 dispositions with composition/terrain limits |
| [P02 Scrapyard](P02-scrapyard.md) · [JSON](P02-scrapyard.json) | 29 wreck, debris, pile, component and utility candidates | [Independent review](P02-scrapyard-review.md): exact crop checks and qualified identities |
| [P03 Cabinets](P03-cabinets.md) · [JSON](P03-cabinets.json) | Nine vendor-index candidates across three render variants: 27 records | [Independent review](P03-cabinets-review.md): all 27 records/nine concepts dispositioned |

The 85 records include component pieces and variants, not 85 unique gameplay
objects. All remain unapproved proposals. Current source-reference and semantic
fields are trial formats; they are not a unified runtime catalog contract.

Read the [coordinator reconciliation](../notes/2026-10-04-pilot-reconciliation.md)
before reusing proposal labels or evidence. It supplies authoritative corrections
to the frozen snapshots while preserving each reviewed JSON hash.

The [P03 topology supplement](P03-cabinets-topology.json) adds the owner's explicit
non-standalone rule for all 12 records of cabinet components 41–44, with required
connections and assembly completeness. These constraints are saved metadata;
the shared validator enforces these chains; runtime enforcement remains pending. This clarification is not a
registered approval of every rendered combination or of gameplay geometry.

## Expansion packets

| Packet | Scope | Review / delivery |
| --- | --- | --- |
| [E01 Outdoor seating](E01-outdoor-seating.md) · [JSON](E01-outdoor-seating.json) | 27 benches, camping chairs and picnic-table exports; 25 direct master matches, two original-only benches | [Independent review](E01-outdoor-seating-review.md) supports all 27 with explicit exceptions; [fourth family sheet](https://tilefun.graehlarts.com/tilefun/workshop.html#/tool/families?family=outdoor-seating) presents 15 cards and chair colors |
| [I01 Sofas and seats](I01-interior-sofas.md) · [JSON](I01-interior-sofas.json) | 18 normal Basement pieces plus two render counterparts; 15 assembly probes | [Independent review](I01-interior-sofas-review.md) supports all 20 and 15 assembly probes; four lower-seat roles remain unresolved |

Packet totals are source records, including components and variants. E01's
normalized integration preserves the original-only master status even though two
exact public PNG copies now support ordinary browsing. I01 is normalized as twenty records / eighteen proposal units and has a
[fifth family sheet](https://tilefun.graehlarts.com/tilefun/workshop.html#/tool/families?family=sofas)
with eighteen cards and nine positive assembly examples. Four roles remain unknown.


## Delivered component and animation expansion

| Packet | Source record scope | Independent review |
| --- | --- | --- |
| [RB01 Room Builder](RB01-room-builder-path-arch.md) · [JSON](RB01-room-builder-path-arch.json) | 17 floor pieces, six fixed arch cells and two shadow strips | [Review](RB01-room-builder-path-arch-review.md): 25 records, 16 assembly and two contextual wall probes; inset/height alternatives and shadow differences retained |
| [E03 Playground tubes](E03-playground-tubes.md) · [JSON](E03-playground-tubes.json) | 19 ochre shapes plus six blue/red counterparts | [Review](E03-playground-tubes-review.md): 25 records, eight frozen probes and five supplemental challenges; required cuts distinguished from entrance mouths |
| [A01 Door animation](A01-animation.md) · [JSON](A01-animation.json) | Nine temporal source frames / eight pixel states / two sequences | [Review](A01-animation-review.md): full static/packed/corpus checks and exact companion GIF correspondence; game playback remains unknown |

These 59 component/frame records now have explicit normalization and three quiet
family sheets, bringing the total to 191 records / 164 proposal units. The
[delivery record](../notes/2026-10-04-component-family-delivery.md) preserves exact
validation and review scope. No human approval or gameplay metadata is inferred.


## Reviewed plants, bedroom and fence slice

| Packet | Bounded source scope | Independent review |
| --- | --- | --- |
| [E04 Plants and planters](E04-plants-planters.md) · [JSON](E04-plants-planters.json) | 19 broadleaf trees, flowers and pots; seven proposed display groups | [Review](E04-plants-planters-review.md): all 19; three native transparent-frame restorations retain partial-master lineage |
| [I02 Side beds and blankets](I02-bedroom.md) · [JSON](I02-bedroom.json) | 18 records / six units in three render variants | [Review](I02-bedroom-review.md): all 18 and 17 overlay probes; twelve beds retain original-only master lineage |
| [E05 Fences and garden gates](E05-fences-gates.md) · [JSON](E05-fences-gates.json) | 22 picket components, four separate garden gates and one shrub trial | [Review](E05-fences-gates-review.md): all 27 and 14 probes; gate-side and cross-kit joins unproven |

These 64 source records / 52 proposal units are explicitly normalized and delivered
as three quiet sheets with 38 cards. The [delivery record](../notes/2026-10-04-plants-bedroom-fences.md)
records independent source and implementation review, bringing the total to 255
records / 216 proposal units. Registry entries alone do not grant coverage,
human approval or gameplay geometry.


## Broad first-pass sheets

| Packet | Delivered scope | Review stage |
| --- | --- | --- |
| [B01 Kitchens](B01-kitchens.md) · [JSON](B01-kitchens.json) | 166 cards / 408 normal kitchen exports, including counters, storage, appliances, dining and small props | Source-pinned proposal; coordinator sampled components and underlays |
| [B02 Music/recreation](B02-music-recreation.md) · [JSON](B02-music-recreation.json) | 93 cards / 213 instruments, audio, screens/games and table-game exports | Source-pinned proposal; independent sampled visual review |
| [B03 Street hardware](B03-street-hardware.md) · [JSON](B03-street-hardware.json) | 155 cards / 381 signals, lamps, poles, signs, utilities and barriers | Source-pinned proposal; independent sampled visual review |

The [targeted adapter review](../notes/2026-10-04-broad-adapter-review.md) records its
scope and limits. These 1,002 first-pass records use one compact contract and appear
in the Workshop; they are registered without exhaustive normalized-model credit.
The earlier 255 records / 216 proposal units remain separately normalized.
