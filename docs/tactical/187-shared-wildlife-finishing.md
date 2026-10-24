# Shared wildlife finishing

Owner authorized the correction, hardening, commit and push on 2026-10-24,
following the [206-entry source audit](../wildlife-outline-audit.md).
This authorizes new correction identities, including provisional gameplay use;
it does not invent human approvals or overwrite registered banks.

## Scope and contract

Use one explicit finishing policy for each complete animal bank. Preserve the
camera, native canvas, anchors, clip columns/timing, geometry, motion and action
sockets. Retain the original painted detail for deer, all three cat coats and
donkey through their new actions. Replace automatic exterior silhouette growth
in the 136 affected entries with source-owned surface paint, preserving actual
dark fur, eyes, noses and markings. The ten small mammals are the first visual
prototype family. Other paint methods remain explicit retained policies.

Historical sources, receipts, exact review objects and public pixels remain
immutable. New `finish-v1` revisions reference checksum-pinned editable sources
and the versioned shared painter, and register as pending human review. Builds
consume committed images and never regenerate source banks.

## Work

1. Establish the shared surface/retained-parts painter, policy manifest and
   read-only Blender extraction of missing painted-part transforms. Review deer
   and small-mammal prototypes at native/enlarged scale before applying the policy.
2. Generate complete new banks, with exact input pins, replay, native contact and
   chronological animation evidence. Keep all clips on their animal's policy.
3. Route game and Animal Browser to the same corrected identities; preserve
   behavior timing, sockets and physics. Register every correction in Workshop.
4. Add narrow source/asset checks for bank coverage, retained paint, transition
   endpoints, no silhouette inflation, exact metadata and immutable predecessors.
5. Regenerate catalog/manifest. Run types, native tests, lint, build and browser
   validation using isolated data and bundled Chromium. Record environmental
   failures separately. Commit, rebase if needed and push the current branch.

## Initial checkpoint

The audit identifies four outward-border painter discontinuities (deer and
three cat coats), donkey's inward-border discontinuity, and 132 banks with the
automatic outward border throughout. All 4,888 sampled source cells reproduce.
Current Workshop inbox and art notes have no pending requests. `origin/main`
was fetched and its boat/building correction rebased before implementation;
the prior investigation documents were preserved.

## Implementation checkpoint

All 206 active entries have explicit contracts in
`art-source/wildlife-v2/finishing.json`: five retained-parts corrections,
132 material-surface corrections and 69 retained banks. The versioned
`finishing-v1` painter owns the common finish. Deer, the three cat coats and
donkey carry native body/head/hoof paint through their new actions, rather than
replacing it with filled hulls. Original native cells remain byte-exact in all
five banks. Other corrected banks preserve geometry alpha and actual dark
features, with restrained coat-colored interior edges instead of alpha dilation.

Read-only Blender extraction retains part transforms, joints and editable-scene
hashes. Each new bank references checksum-pinned original `.blend` files,
projections, masters and shared tools; it does not duplicate or resave scenes.
The five generated painted-part projections follow the existing large-projection
lint exclusions; their bytes are checked by input-hash and isolated replay checks.
Git attributes preserve all checksum-pinned helper bytes across platforms.

All 137 new banks reproduce byte-identically in isolated temporary workspaces
containing only their declared inputs: 30,468 pose cells. Each includes native
and enlarged chronological previews, sampled contacts, person-scale scenes,
pixel/source audits, replay evidence and a source receipt. Registration freezes
the new identities and appends pending Workshop objects, preserving all 264
prior review objects. Changed pixels receive no inherited approval.

`FinishedArt` selects complete banks for fauna, predators and deer in both game
and Animal Browser. Clip timing, dimensions, anchors, geometry, behavior and
action sockets remain unchanged. The behavior ledger's sixteen affected action
entries reference the corrected revisions and pending review. The production
table derives its finishing checkpoint from `finishing-progress.json`.

## Validation checkpoint

- Seven pure Pillow checks pass: one-pixel limbs, exact source alpha, real dark
  features/markings, material ordering and rigid retained-paint transforms.
- Four native contract checks pass across all 206 entries and all retained input
  hashes, predecessor immutability, exact metadata, all native painted cells in
  five banks, and the four-facing deer idle-to-lower transition (at most two
  original tail/leg overlap pixels differ before movement).
- Existing deer/forest/woodland/herd/small-mammal suites: 95 passed.
- Bundled full Chromium preview controls and exact paused crops at 1x/3x:
  1,008 crops across deer and red panda; no page errors.
- Typecheck and lint pass; lint retains its baseline 121 warnings and 42 infos.
- Art catalog: 856 sheets / 1,398 uses. Workshop manifest: 2,118 candidates,
  including full Chromium retina fingerprint parity; production build passes.
- Separate Node comparator: one passed. Real HTTP/WS integration: three passed.
- Worker package: eleven passed and deployment dry-run build passed.
- Staged-source audit: all 2,552 checksum-pinned files are tracked; Git's staged
  bytes match pinned helper hashes and all 264 predecessor review objects match.

The 767.29-second full native run finishes with 6,808 passed / twelve failed /
ten skipped, plus the static-files suite's symlink setup/cleanup errors. Five
failures and that suite are the pre-existing Windows symlink/process cases.
The other seven failures are five-second timeouts under parallel test/manifest
load: three predator recipes, Realm doorway fallback, limousine asset loading,
dog habitat sampling and t-rex persistence. All pass unchanged on targeted
single-worker reruns (eight passed, including the other doorway variant).
The npm chain stops after the failed native stage; its Node integration stage
was run separately and passes. Local logs are in ignored `data/wildlife-187/`.

Full browser validation and delivery are in progress. Human review remains
pending; the next art step is owner review of these exact correction identities.
