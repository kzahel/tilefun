# Broad-sheet owner corrections — 2026-10-04

The owner reports the broad sheets look good overall. Trusted source notes add
“Looks great” for kitchens, “Good” for music/recreation and “Looks good” for street
hardware at the exact first-delivery revisions in the [delivery record](2026-10-04-broad-first-pass.md).
These are positive observations, not synthesized API approvals or inferred physics.
Two exact member corrections are applied through the versioned
[semantic supplement](../packets/broad-owner-corrections.json); original proposal
JSONs and their source-review hashes remain frozen.

## Knives

Thread `cc65a563-76f0-4d0f-b6e7-9b0f1a3bbaf2` says “Knives” on kitchen card 140,
record `B01-378`, at family revision
`cd10aa65fcf6b75c737d1f691bb7713d0ff4e3e57b0a1439c74b5ad55c6b1523`.
The exact committed Interiors crop is `[32,7214,16,32]`, named Kitchen Singles 378.
Inspection supports upright knives. Rename the card/record “Upright knives” and
move it from Sinks and dish racks to Food preparation. Keep its stable card number,
ID, original variant and source rectangle. No geometry change follows from the name.

## Repeating utility pole and wires

Thread `577d3b9a-3008-40b6-8e41-a426d6f1a252` says “Probably meant to loop/repeat.
Not cut off” on street card 110, record `B03-289`, at family revision
`758d8ba08540383845336d60a01bd73495cb43261c79e87501c050829a4609f5`.
The exact Exteriors crop is `[928,1904,80,64]`, Electric Pole 6. A native-size probe
places three unchanged copies at `[0,0]`, `[80,0]`, `[160,0]`. Visual inspection
shows continuous paired sagging wires. The first two and last two columns all
contain opaque wire pixels only at local rows 21 and 26, color `(58,58,80,255)`;
the zero-offset horizontal seam agrees on both wires.

Rename the card/record “Utility pole with repeating wires”. Change unknown role
to component, with matching self-neighbors at horizontal stride 80 and vertical
stride zero. The structured repeat metadata retains the neighbor record, stride
and edge rows. Both sides connect to more wire; a finite network still needs end
pieces. Endings, corners, branches and arbitrary offsets remain unproven. This is
a supported repeat hypothesis, not owner approval of every wire-network layout.
No example is added to the sheet and no source or rendered sprite pixels change.

Reproduce the finite source probe with Pillow:

```python
from PIL import Image
sheet = Image.open('public/assets/tilesets/me-complete.png').convert('RGBA')
pole = sheet.crop((928, 1904, 1008, 1968))
probe = Image.new('RGBA', (240, 64))
for x in (0, 80, 160):
    probe.alpha_composite(pole, (x, 0))
probe.save('/tmp/tilefun-wire-repeat-native.png')
for x in (0, 1, 78, 79):
    assert [(y, pole.getpixel((x, y))) for y in range(64)
            if pole.getpixel((x, y))[3]] == [
        (21, (58, 58, 80, 255)), (26, (58, 58, 80, 255))]
```

## Delivery and validation

The reusable adapter applies semantic-only supplements after checking the frozen
proposal hash. It verifies the exact single-record card and permits only semantic
fields; changes to source artwork, IDs or card membership are rejected. The usual
role consistency and source pixel checks then run on the corrected proposal.
Twelve other family objects, all sprite variants, record references and every
existing rendered example compare equal to commit `2205c50`.

New kitchen revision: `1b9d1ac0a4bc17d0198cc8969260ba80d02eb9329d31331ace60cb79c148205c`.
New street-hardware revision: `8e386970e3d1371691a1277fe5ca5331a1f9005e03ab93f7b8268bcac539f0c8`.
Earlier comments keep their original revision scope. Counts remain 14 sheets,
583 cards / 1,257 records; the normalized model remains 255 records / 216 units.
No inbox messages, approval events or note statuses were written.

Validation in an isolated snapshot:

- Typecheck, build and lint pass (existing lint/chunk warnings remain).
- Unit run: 1,548 passed, one existing FurnitureMotion test hit its five-second
  timeout during the parallel run. Its entire 12-test file passed on isolated
  retry without changes or a raised timeout, covering all 1,549 unit tests.
- Broad adapter: eight tests pass, including semantic correction/source immutability.
  Shared family adapter: ten tests pass; deterministic generated-data check passes.
- All 28 family-sheet browser tests pass, including responsive layouts, source
  revision blocking, exact variant note targets and whole-sheet comments.
- Regenerated art inventory is unchanged. The regenerated Workshop manifest changes
  only the two revised family candidates and its input digest.

Unrelated railway work remains outside this metadata correction and is excluded
from its validation snapshot.
Next: continue similarly broad themes, applying owner corrections through this
small semantic supplement rather than rewriting the frozen source proposals.
