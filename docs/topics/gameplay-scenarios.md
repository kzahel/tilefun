# Gameplay scenarios

Status: shared recipe/runtime refactor in progress, 2026-10-03.

Interactive Workshop examples should run the same GameServer/Realm simulation,
replication, prediction and rendering as gameplay. Recipes describe initial
content and explicit settings; hosts supply temporary storage and scheduling.
[027](../tactical/027-composable-gameplay-scenarios.md) owns the implementation
sequence and evidence. Current migration targets are traffic, furniture motion,
outdoor/vehicle geometry walkers and character motion. Static art diagrams and
frozen review images remain render fixtures.

Preserve normal world storage and immutable art banks. Lab candidate overrides
must be scoped to a session and shared by authority and its client replica.
Next: implement and validate the recipe/session foundation, then migrate labs.
