# NPC support across physics owners

Status: delivered and validated for owner inspection, 2026-11-02.
Owner: [physics engine](../topics/physics-engine.md).

The owner could stand on another player in the lab but an ordinary game NPC
shifted away during landing. The previous two-player fixtures did not exercise
the real NPC AI and overlap-separation phase.

The real Realm reproduction drops a player onto an idle chicken/person, retaining
the normal NPC brain and EntityManager update. Rapier reaches the NPC's top with
a tiny numerical penetration (for example, 23.999956px against a 24px top).
The legacy player/NPC separator still iterates every player, even those already
stepped by the character solver, and turns that overlap into a roughly 6.5px
horizontal NPC displacement. A capsule's narrower footprint can also be clear
while the legacy player box overlaps. This is duplicate contact ownership.

Realm now identifies the opted-in on-foot players actually pre-stepped this tick
and excludes them from EntityManager's legacy player/NPC overlap response. It
does not exclude them merely because their movement was already processed:
ordinary legacy players still use that separator. NPC AI, NPC/NPC separation,
and legacy mounted/vehicle handling retain their existing owners. The selected
character solver treats NPCs as query obstacles; this slice does not migrate NPC
motors or provide dynamic NPC pushing/carry. NPCs may still move voluntarily.

Native regression coverage exercises full landing/rest for chicken and person
with both hulls through the real Realm and checks that legacy NPC pushing remains
while the selected capsule respects its own clearance. The normal-game browser
test creates a person through the editor, befriends it to hold voluntary movement
idle within following distance, then uses ordinary keyboard input to land and
stand on it. It retains the Worker, AI, replication and normal renderer. Reduced
gravity in that test lets the player clear the person's 24px height; production
jump settings are unchanged. Freezing the player/session would skip the failing
NPC phase and is deliberately avoided.

Validation: 170 focused native tests in eleven files pass, including both NPC
types/hulls, legacy pushing, prior player pushing/support/jumping and prediction
parity. All three TypeScript projects pass; changed-file Biome checks pass with
two pre-existing Realm non-null assertion warnings. The production build passes
with refreshed catalog/manifest and 2119 candidate identities checked in full
Chromium at retina scale. Both selected full-Chromium cases pass: the normal
Worker game (including the actual NPC landing) and shared geometry contacts.
The standing-on-NPC screenshot was inspected. The isolated default streaming
benchmark completes six phases with no errors or failures; this is default-path
evidence, not a Chromebook or experimental-backend performance claim.

The requested read-only `gpt-6.1-sol` reviewer through localhost:3400 Yep Anywhere
ran at verified `high` effort and found no actionable findings against `dcd2fd27`.
It checked ownership, default pushing, mounts, vehicles, noclip, input gaps,
NPC/NPC separation and prediction consistency without running the checks above.
Next: owner repeat the original ordinary-game NPC landing with Save and reload.
