# 137 — Fierce creatures and a shared food web

Status: in progress. Owner authorized all five creatures, cross-species hunting,
natural-only meal replacement, autonomous delivery and per-stage commits/pushes
on 2026-10-18. Owns this bounded expansion; [wildlife](../topics/wildlife.md) owns
current contracts. Historical repair holds and human art review remain separate.

## Delivery

- [x] Natural-only replacement: durable origin, manual prey stays gone, repeated
  natural replacements retain lineage through reload, deletion never respawns.
- [ ] Shared explicit food web covering native wildlife, existing predators and
  the five new species; no self-eating, player/pet/rider meals or duplicate catches.
- [ ] T. rex: own biped source, head/tail/weight transfer, heavy patrol, roar,
  wind-up/short charge, feeding/rest and natural/editor/lab integration.
- [ ] Small dragon: own winged body, guarded treasure, sleep/wake/display,
  hunting and natural/editor/lab integration.
- [ ] Dire wolf: own canid source, howl, bounded pack coordination, hunting and
  natural/editor/lab integration.
- [ ] Griffin: own eagle/lion source, perch, validated aerial approach and landing
  attack, hunting and natural/editor/lab integration.
- [ ] Giant spider: own eight-leg source, web ambush, sudden scuttle/pounce,
  hunting and natural/editor/lab integration.
- [ ] Final actual-world food-chain, natural/manual origin and reload evidence,
  production table refresh and clean pushed combined head.

## Contracts

One shared Realm implementation owns decisions, collision, meals and origin.
Canvas/GPU, single-player Worker, dedicated server and embedded labs consume it.
Food relationships are explicit game rules, with recognizable size/threat tiers;
new creatures can be prey themselves, including dire wolves eaten by T. rex.
Tamed/following/ridden actors, players and companion cats/dogs remain protected.
Only known natural-origin prey receives a same-species replacement. Preserve its
home and source lineage; assign a new durable ID and tombstone the old generated
individual. Do not infer origin from location, species or old unmarked offspring.
No generic removal/delete hook replenishes anything.

New art uses separate immutable revisions, editable Blender geometry, fixed
40-degree camera at native 10px/unit, physical body/limb motion, source audits,
native chronological review and reproducible palette masters. Registered review
is pending, never a synthesized human approval. Existing banks stay exact.

## Checkpoints

Origin implementation passes 57 focused predator/recipe checks, including manual
meals without replacement space and natural second-generation replay. Actual
Worker/editor/save/reload checks and the existing four predators pass all 13
browser cases. Typechecks, lint, build and 839 exact Workshop identities pass.
Full units: 2,728 pass; the same five Windows symlink/WAL failures and ten skipped
tests remain. Broader browser fail-fast: 45 pass, known GPU city-train reload
distance failure, one interrupted deer case and 615 unrun. No full browser pass
is claimed. All six streaming readiness phases pass. Natural-only replacement is
ready for its first commit/push; creature sources and the food web follow.
