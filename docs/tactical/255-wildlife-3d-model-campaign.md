# 255 Wildlife 3D model campaign

Active. The owner authorized authoring and reviewer dispatch on 2026-11-19.

[Complete roster](255-wildlife-3d-model-campaign/roster.md) ·
[Execution log](255-wildlife-3d-model-campaign/progress.md) ·
[3D asset runbook](../3d-asset-runbook.md) ·
[3D assets topic](../topics/3d-assets.md)

[256 Wildlife 3D game rollout](256-wildlife-3d-game-rollout.md) owns the next
phase, including distinct animation per gameplay state and normal-game release.

## Goal for launch

> Author a fresh, animated Blender model for every existing Tilefun animal in
> the 3D campaign roster. Match or improve the corresponding live sprite’s
> expressiveness, silhouette, palette, and motion at normal play zoom, using
> the tuxedo cat draft as the quality benchmark. Deliver editable Blender
> sources, game-ready animated GLBs, matched stills and video, and an independent
> Yep Anywhere Opus review for each animal. Use at most two candidate versions
> per animal. Keep any unresolved quality gaps visible for owner review.

The baseline covers **219 animal identities**, including 206 current Animal
Browser entries and 13 classic animals exposed by Edit → Entities. It includes
coat variants, fantasy creatures and the two upright wildlife companions. Use runtime entity
type as the stable key, since classic and wildlife versions can share a name.
Animal-themed playable and NPC character appearances belong to the separate
character catalog. The [roster](255-wildlife-3d-model-campaign/roster.md) records
that boundary and pins each sprite source for this planning snapshot.

The cat is an existing draft and a quality reference. Its first comparison used
`behavior-v1`, the source for the currently loaded `finish-v1` sprite. At launch,
recapture it against `finish-v1` before independent review. The rabbit is an
existing in-game model with runtime part poses for hopping and feeding. Audit it
against the same quality bar and retain the existing model if it meets the brief.
Both entries still need campaign review and clip coverage checks.

## Authoring and evidence

1. **Pin the reference.** Resolve the active runtime sheet, frame definitions,
   origin and speed for the exact animal. Capture native-size idle, travel and
   signature-action poses. Identify the traits that carry recognition at that
   size, such as eye and muzzle placement, ears, tail, markings or wing shape.
2. **Author fresh geometry from the sprite.** Build the silhouette and anatomy
   in Blender, with a useful ground or swim origin and an editable rig. Use
   existing source records for reference and timing. Closely related coats can
   share a newly authored body and rig when their sprites support that decision.
   Compare and review each appearance separately. Organize shared tooling around
   locomotion and anatomy while tailoring proportion, paint and rhythm to each
   animal.
3. **Paint and animate.** Use broad, crisp palette bands and nearest-sampled
   paint. Concentrate contrast on the features that survive at normal zoom. Map
   idle, travel and the reachable runtime actions to named model clips or
   documented shared poses. Use existing game facing, movement and timing. Check
   paw placement and takeoff/landing for grounded animals, wing and perch contact
   for fliers, and the relevant swim, crawl, slither or pulse cycle elsewhere.
4. **Export and compare.** Retain the Blender source with packed paint, the
   self-contained GLB, a reproducible build/export command and a short report of
   scale, triangles, primitives, materials, texture size and clip names. Reopen
   the `.blend`, load the GLB, and check sampled poses, loop seams, bounds and
   anchors. Capture the sprite and model under the same game camera, scale,
   facing, background and clip phase. Include native-size frames, nearest-neighbor
   enlargements of all relevant facings, and a close view. Produce a side-by-side
   video of ordinary travel and a signature action, plus timestamped stills of
   important poses. Preserve those files by exact candidate revision.
5. **Review and disposition.** Send the exact packet to Opus. If the reviewer
   identifies a material gap in the first pass, address the most important items
   and resubmit the revised comparison. Two versions means one first pass and at
   most one improvement pass, with at most two review rounds. A first-pass match
   can finish in one review. At the cap, record any remaining issue and carry on
   with other animals. Keep that entry open for owner disposition. Record reviewer
   verdict, asset fingerprint, evidence paths and next action beside the animal’s
   state.

## Yep Anywhere review work

Use the local v0 API and a separate Claude reviewer. Read-only discovery on
2026-11-19 confirmed that this session advertised management access, Tilefun was
visible, and selection listed **Work-claude**, **Claude Opus 5.5** and **medium**.
The Work pool advertised `weekly-pace`. Recheck from the launch session because
grants and pool eligibility can change.

1. Read `/v0/me`, `/v0/help`, and `/v0/servers/self/access` and `/capabilities`.
   Resolve the Tilefun project from `/projects`, verify `claude` in `/providers`,
   and find the Work pool and eligible model in `/selection?provider=claude`
   under the same server prefix. Use `/v0/schema?operation=createSession` for
   the exact fields. Resolve IDs at launch. Keep credentials and routing/account
   IDs out of the repository.
2. Launch a review in the Tilefun project with `POST /v0/servers/self/sessions`.
   Use `provider: claude`, `model: claude-opus-5-5`, `thinking: on:medium`,
   `permissionMode: bypassPermissions`, and the discovered `routerPoolId` and
   Work pool policy. Give it a review-only prompt and paths to the exact local
   evidence. If the requested route is unavailable, record the review as pending
   and continue any independent authoring. Retry through the specified pool once
   eligibility returns.
3. Use an `Idempotency-Key` unique to the campaign, animal and candidate revision.
   Persist the key, receipt and session ID in local run state. On uncertain
   submission, reuse the identical request key and body and reconcile receipts
   or session relationships before dispatching further work. Follow the receipt,
   verify effective model, effort, permission and routing in session detail, then
   follow the conversation until it contains the explicit verdict. An admitted
   session or idle state alone provides no review result.

### Reviewer brief

> Open the referenced native sprite/model views, enlarged comparisons and
> timestamped motion frames. Use the video when your tools can inspect it.
> Judge recognition and charm, silhouette, palette and markings, fit in the game
> camera, and animation clarity and contact. Use the exact live sprite as the
> baseline and the tuxedo cat as the finish benchmark. Return `meets-bar`,
> `revise`, or `insufficient-evidence`. Include up to three concrete findings
> with view or pose references and the highest-impact fix. Review only and
> return your findings in the session conversation.

Opus feedback is independent art direction. Formal Workshop approval follows the
[owner review workflow](../topics/art-review.md), including exact candidate
registration and retained review evidence when candidates are submitted.

## Order and game qualification

- **Calibrate on the existing cat and rabbit.** Pin the game references, test the
  review handoff and validate the reuse of one capture workflow. Try the dog and
  mallard next, then sample a flier, a swimmer and a small crawler so camera fit
  and animation conventions cover different body plans early.
- **Work through the roster in small related groups.** Start with familiar pets,
  farm animals and nearby wildlife. Follow with the remaining land, air, aquatic,
  arthropod and fantasy entries and the classic appearances. Keep one ledger row
  per runtime type and advance authoring while earlier packets are in review.
  Report completed, pending, and capped entries after each group.
- **Qualify runtime support in a bounded slice.** The live rabbit renderer uses
  instanced rigid parts. The cat draft uses a skinned GLB with embedded clips
  and currently plays in the comparison harness. Prove that the shared game and
  lab renderer can sample approved candidate poses before relying on it for the
  roster. Verify clip timing, contacts, depth and occlusion, model loading and
  failure, the 3D animals switch and sprite fallback. Include a multi-species
  crowd when measuring draw, upload and animation cost on target hardware.
  Consult [renderer unification](../topics/renderer-unification.md) and
  [embedded engine labs](../topics/embedded-engine-labs.md) for integration.
- **Prepare for owner review.** Keep the current sprite banks immutable. Retain
  sources and qualified exports through the established asset workflow. Use
  shared game/lab previews for playable candidates and follow the Workshop
  promotion process for any default roster rollout.

Completion requires an independently reviewed model and evidence for each
roster entry, with the quality bar and runtime checks satisfied. If an entry
still falls short at the two-version limit, report it as open with the remaining
issue and the best version on hand. Record any owner-approved exception.
