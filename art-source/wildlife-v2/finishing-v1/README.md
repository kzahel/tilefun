# Wildlife paint v1

`../finishing.json` declares one complete-bank policy for every active animal.
This version is the correction authorized in tactical 187. New registered banks
use `finish-v1`; historical source and review banks remain immutable.

- `painter.py` owns source-surface rasterization, stable material ordering,
  restrained coat-colored interior edges, and rigid painted-part transforms.
  It never dilates the animal's alpha. Actual dark materials and markings remain.
- `parts.py` carries existing deer, cat-coat and donkey body/face/hoof paint into
  new poses. Geometry supplies part ownership and contact, not replacement art.
  A genuinely edge-on paint plane uses its source material surface during 3D roll.
- `retained-bank` contracts keep existing painted art unchanged. They are an
  explicit authoring choice, not permission to bypass a policy for later actions.

For an animal's next action, reuse its declared paint owner/policy for every
clip. A shared palette alone is insufficient: preserve coat/face patterns,
leg weights, native scale, anchors, geometry, timing and sockets. Check native
transition endpoints and chronological four-facing motion, not just cropped
frames from the same generated PNG.

Normal builds consume committed pixels. Author/check explicitly from repo root:

```sh
python scripts/wildlife/test_finishing.py
blender -b --python-exit-code 1 --python scripts/wildlife/project-paint.py -- deer
python scripts/wildlife/finish-bank.py --animals deer
python scripts/wildlife/finish-bank.py --animals deer --check --record-replay
node scripts/wildlife/finished-art.mjs
node scripts/wildlife/register-finishing.mjs
```

Projection/build/record/registration refuse registered identities. After a
receipt exists, `--check` performs a read-only byte replay in a temporary workspace
containing only checksum-declared inputs. It compares all public outputs and
the reproduced input manifest. No Blender source is edited or resaved.

Registration appends exact pending Workshop objects without changing older
objects. Old approvals never apply to corrected pixels. Future changes to this
frozen painter require a new version and new review identities; do not alter its
registered files to repair an already registered bank.
