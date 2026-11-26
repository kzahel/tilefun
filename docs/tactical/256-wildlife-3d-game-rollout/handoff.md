# Handoff for the wildlife 3D rollout

Tactical 256 completed on 2026-11-26. The public game at `663f1a85` ships
all 219 models by default. The animation ledger links their gameplay
receipts for all 1,023 states. The earlier resume prompt below records
how the rollout was performed.

Paste the following into a new session started in the Tilefun checkout.

```text
Create a goal in this session and resume Tactical 256 from the latest
checkpoint recorded in the tactical and its animation ledger:

Complete Tilefun tactical 256. Ship all 219 animals from the tactical 255
roster as default 3D animals in normal live play. Give every reachable existing
gameplay animation state a distinct sprite-guided 3D animation per animal,
at the tuxedo cat finish bar. Retain editable Blender source, exact GLBs and
comparison evidence. Verify the shared game/lab path, sprite fallback,
performance, and the deployed revision. Keep the per-animal and per-state
tracker current and continue across batches until the live roster is complete.

Read AGENTS.md, docs/tactical/256-wildlife-3d-game-rollout.md, and the animation
ledger beside this prompt. Start from the same checkout, inspect git status
and the latest commits, and reuse the committed renderer and authoring work
and the draft sources under data/wildlife-3d-campaign.
That directory is local data. If this session is in a new checkout, locate
and restore the campaign archive from the previous session and verify the
ledger hashes before relying on its models.

The old preview proved that all 219 assets can render. It covers 1,023 current
animation states, including 219 bindings that reuse another state's GLB action
on the same animal. Give those states their own pose curves and verify each
action at game size and at its gameplay speed. Keep gameplay and saved worlds
compatible. Continue from the completed playable pilot and registered batches.
Run the inventory audit and check the current Workshop inbox and notes first.

Preserve 255's asset evidence, unresolved findings and reviewer queue as
history. Register and qualify new assets through Tilefun's shared model
catalog. Keep new candidates available in exact Workshop previews until
the matching fingerprint is approved. Use promote-3d-rollout.mjs to select
the approved file for default play. Exercise the sprite preference and
fallback. Record the exact production evidence and any genuine blocker in
the ledger. Close the goal after verifying the deployed game and every
roster entry and animation state.
```

The draft archive is `data/wildlife-3d-campaign/tilefun-animals.zip` in
the authoring checkout. The [255 progress log](../255-wildlife-3d-model-campaign/progress.md)
links the comparison gallery and prior runtime results. The archive contains
the editable inputs, GLBs and comparisons. Exact reviewer receipts and local
session state stay in the original checkout.

## Resume checks

Use Node 24.22.1 for the build and verification scripts. Run:

```sh
node --import tsx scripts/wildlife/audit-3d-rollout.mjs --drafts
npm run workshop:inbox
npm run art:notes
```

The [tactical delivery log](../256-wildlife-3d-game-rollout.md#delivery-log)
identifies completed and pending batches. Preserve their immutable files and
review fingerprints. The published review checkout is
`https://tilefun.graehlarts.com/tilefun/`. The CI deployment publishes to
`https://kzahel.github.io/tilefun/`. Run the renderer's `--defaults` check
and verify a fresh ordinary game entry on the shipped revision. Record the
revision, URL, runtime hashes and observed default states in the ledger.

The November 26 resume began from base commit `23e99752` and reused the
archived Blender drafts. All 219 animals have registered exact candidates
and all 1,023 states have distinct qualified actions and observed gameplay.
The ledger initially had production evidence for 113 defaults and their 515
states. The owner then approved all 106 remaining candidates expressly in the
rollout conversation, and Workshop recorded the exact decisions. The three
promotion releases verified the remaining 508 states in the deployed default
game. The delivery log and ledger link the exact receipts.
