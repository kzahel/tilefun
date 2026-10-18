# Ground hunter source family, tactical 140

Self-contained empty-scene Blender builder, source-driven palette finisher and
independent saved-scene audit. Per-species wrappers supply only the species ID;
profiles.json owns distinct anatomy, palettes, limb proportions and source
walk/chase travel. No historical source or painted parts are read.

The wolf has a broad grey ruff/pointed ears, coyote a narrower buff body/longer
muzzle and taller ears, and hyena high shoulders/lower haunches, rounded ears,
short mane and separately modeled spots. Four fixed links per limb, independent
paws and a three-link tail carry moving torsos above planted contacts. Separate
head/jaw parts supply feeding and display. Walk and chase each have 32 native
poses with dense source keys, followed by independent continuous audit.

All files named by a registered inputs.json are immutable. Refine a future
family revision under a new directory, preserving every existing receipt.
WILDLIFE_OUTPUT_DIR isolates draft outputs until the previous batch is committed.
Ordinary builds never run this authoring code. Exact final pixels remain pending
human review even after agent source/native/replay/game checks pass.
