# B02 — Music and recreation

Broad first-pass proposal: **93 cards / 213 normal source records**, in eight
plain groups. This follows the owner's larger-sheet preference; it is not a
measured accuracy claim or approval. No shared model, runtime art or gameplay
geometry changes are included.

The full Music and Sport normal-theme overview and all 249 indexed exports were
inspected. Selected exports 1–75 and 165–242 cover both instrument generations:
upright/grand pianos and benches, organs/keyboards, acoustic/electric guitars,
harps, microphones, speakers, small/hand drums and complete drum-kit views.
Finish, sheet-music, stool, drum-stick and view variants stay with their item.

The full Basement overview and all 246 indexed normal exports were inspected.
Relevant selected clusters add televisions/media/game units, arcade cabinet
views, billiard pieces/accessories and complete billiard/table-tennis tables.
Living Room and Television/Film Studio overviews were also inspected as context;
their general furniture, cameras, stages and lighting were excluded. Music-theme
sports balls, trophies, posters and plaques, general Basement furniture,
picnic baskets, doors/walls and unrelated gym equipment are excluded. Black
shadow/shadowless sets were deferred; this sheet already has useful native
finish and state variants without additional counterpart research.

Twenty-one cards carry concise uncertainty. Organ versus synthesizer names,
wind/hand-drum types, one alternate electric-guitar view, media-box models and
the screen/panel cluster are hypotheses. The small stand and three tall panels
have unknown roles/standalone eligibility. Source glow/trim variants do not
claim animation. Narrow drum-kit views are complete kits seen from the side,
rather than mandatory pieces of a front view.

Eight records are explicit components: six colored billiard halves and two TV
cabinet halves. Their cards retain matching-half requirements. Two representative
ordered source-over examples join green billiard halves and the TV cabinet
halves at `[0,0]` / `[32,0]` in native `64×48` canvases. Both assembled views were
visually inspected and show continuous furniture surfaces. These are finite
proposed examples, not arbitrary join or placement rules.

Every selected record uses an exact committed modern-interiors atlas crop and
its exact packed index key/original path. All 213 available original exports
matched the committed crop as normalized RGBA in their complete native frame;
all 213 pixel states are distinct. Native transparent padding is retained
(`frameSize` equals native crop size, `offsetXY=[0,0]`). Packed presence does not
claim original master correspondence. Each record appears in exactly one card
variant; kinds are 201 whole, eight component and four unknown records.

Reproduce selected contact sheets and both examples:

```sh
python3 scripts/semantic-map-broad-music.py --check --capture-dir /tmp/tilefun-B02/cards
```

The helper pins the committed atlas/index, replays every native crop, compares
original frames when present and verifies deterministic packet bytes. A fixture
with no original assets reproduces the identical packet and all 213 committed
frames; present mismatching originals fail. No broad absence/alias search was
run. The next step is the generic broad-packet audit and owner sheet discussion;
uncertain labels can be corrected without waiting for exhaustive mapping.
