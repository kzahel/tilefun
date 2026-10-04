# A01 door animation — coordinator independent review

2026-10-04. Reviewer: coordinator, separate from the animation mapper. Agent review
only; no human approval or runtime promotion. The brief named two door strips and
the helper header/frame slicing were visible before inspection, so this is not a
blinded interpretation. Source pixels were inspected before reading the proposal's
semantic fields or matching claims.

## Initial source observations

I cropped both original PNG strips directly into 16×32 native frames and enlarged
them by an integer factor on a neutral background. The first strip has five frames:
a brown handled panel within a dark outer frame progressively narrows toward the
left edge, exposing transparent space to its right. The stable outer frame and
panel changes support a door opening sequence in the source's left-to-right order.
The pixels alone could also play backward as closing; timing and intended playback
need separate evidence. The second four-frame strip keeps the door closed while
small panel/handle positions change. A failed attempt or rattle is plausible;
locking mechanics are not established by the visible movements.

[Independent source frame view](/tmp/tilefun-A01-root-source.png) is temporary.
The source strips, exact frame rectangles and reproducible mapper helper preserve
the durable evidence. Detailed pin/correspondence and GIF checks follow below.

## Exact snapshot and disposition

Supported as a bounded nine-frame proposal, with timing/loop/game behavior and
source occurrence counts kept separate. No blocking inconsistency found.
Reviewed final proposal SHA-256:
`f0e5f627c4e8fe27c5de9c83c5b2ba98d60f273fd7361be07a914563a49e9f0c`.
Helper SHA-256:
`3d38cba0d97590d4697f1bf3c39bf527aa6a824176c28a7e1ed94d5a1d4a73a3`.
The hash was rechecked after final independent validation. The earlier authoring
snapshot was checked before an alpha-tight corpus challenge was added; only this
final pin carries the disposition below.

| Record | Source index | Independent disposition |
| --- | --- | --- |
| A01-01 | Opening 0 | Closed handled panel; exact static counterpart and duplicate of A01-06. |
| A01-02 | Opening 1 | Panel begins turning/narrowing; retained full frame, not a spatial module. |
| A01-03 | Opening 2 | Further narrowing with increased transparent opening. |
| A01-04 | Opening 3 | Narrow angled panel; not a standalone slim-door prop. |
| A01-05 | Opening 4 | Thin panel at left within the same frame; separate closing states unproven. |
| A01-06 | Perturbation 0 | Same exact pixels as A01-01, retained as another temporal source occurrence. |
| A01-07 | Perturbation 1 | Closed-panel shift; no opening/collision transition inferred. |
| A01-08 | Perturbation 2 | Another closed-panel shift; keep distinct pixels and source position. |
| A01-09 | Perturbation 3 | Closed-panel/handle variation; not a demonstrated successful opening. |

All nine source rectangles and all listed static matches pass exact normalized
RGBA comparison. A01-01/06 both match master `[16,3440,16,32]` and Generic normal,
black-shadow and shadowless `[16,640,16,32]`. This is four physical static source
rectangles, not eight unique static objects. The other seven frame records remain
original-only within the declared static search. Nine occurrences represent eight
pixel states and two proposed action sequences; none is a spatial assembly piece.

## Independent verification

A separate raw-Pillow checker imports neither the mapper helper nor Matcher.
It uses exact row-byte occurrence search followed by every-row verification at all
fitting integer pixel origins, retaining zero-alpha RGB normalization only.
Final results:

- all 84 declared raw source hashes, dimensions and normalized first-image hashes
  match: 82 inventoried PNGs plus two supporting GIFs;
- all nine PNG frame hashes, duplicate relationships and geometry-unknown fields
  match; every adjacent-frame delta reproduces changed-pixel/alpha counts, mask
  hashes and changed bounds (seven comparisons);
- independent complete scans of all 79 declared static sheets reproduce every
  listed occurrence and absence within those domains;
- the committed packed atlas contains no exact full untrimmed frame for any of
  the nine records;
- all 5,368 same-size indexed singles have verified inventory raw hashes and no
  matching full frame;
- all 15,964 indexed singles were independently read and hash-verified; the
  15,957 nonempty alpha-tight bodies produce no exact counterpart for these frames;
- all nine decoded GIF frames equal their same-index PNG frames byte-for-byte,
  with recorded disposal mode and durations; both GIFs contain loop extension 0;
- frozen ledger, packed-index and matcher input pins match.

The source opening GIF orders A01-01–05 at 300/100/100/100/300ms (900ms per cycle).
The closed perturbation GIF orders A01-06–09 at 500/100/100/100ms (800ms).
These recorded demonstration loops reset to the first frame, supplying no closing
animation, gameplay trigger, lock state machine or recommended runtime timing.
All proposed gameplay playback parameters remain null. The locked filename is
context for the demonstration name, not evidence of lock mechanics.

The source-order interpretation is supported over an arbitrary pose bank by the
companion GIFs. A reverse closing sequence remains an unproven alternative. The
padding explanation for absent same-size singles was explicitly challenged with
the independent alpha-tight scan and still found no exact named counterpart.
Neither negative search says the art is missing or excludes recolored, occluded,
clipped, resized or unsearched states.

Independent helper/report are temporary receipts:
[checker](/tmp/tilefun-A01-independent.py),
[final report](/tmp/tilefun-A01-independent-report.json).
The committed mapper reproduction command is:

```sh
python3 scripts/semantic-map-animation.py --check
```

The mapper reports this deterministic replay passed at the final pin. The
coordinator independently repeated the source/search/GIF checks above rather
than treating the mapper's self-check as independent evidence. Corpus raw bytes
were verified; sorted corpus fingerprint serialization was not separately audited.
No runtime definitions, source pixels, approval state or shared application tests
were changed for this research review. Register exact evidence with zero normalized
coverage credit until an explicit animation adapter is implemented.
