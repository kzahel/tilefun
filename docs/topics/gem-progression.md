# Gem collection and progression

Topic: gem-progression
Status: exploration collection restored; spending and unlocks remain undecided.
Updated: 2026-10-25.

## Current behavior

The default regional overworld has finite, seeded exploration gems. Buildings are
the main source: up to five gems per interior, spread across reachable floor clear
of furniture, passages and entrances. Tiny sheds may have fewer. Shopping centers
have two outdoor finds in their parking/walking areas. Ponds, lagoons and large
lakes have up to two finds on their dry northern bank. Other outdoor interest spots
also reward exploration: farmyards, crop edges and pastures; rabbit/deer clearings;
town greens; station platforms; and speedway picnic areas. Forests and groves have
at most one extra find per selected chunk, with a seeded bounded search for clear
ground beside actual trees or thicket edges. Solid forest interiors stay intact.
Obstructed sites are skipped. Existing gem IDs and positions retain their identity;
new categories use independent IDs and do not change other generated populations.
The existing animated gem, automatic walk-over pickup and pickup sound are reused,
so collection works with keyboard, touch and controller. The persistent Gem HUD
shows the current total, including zero, below the Map button in Play and Edit,
indoors and outdoors, on both renderer backends. Its labeled, high-contrast panel
respects screen safe areas and sizes to the count. Buddy totals share the panel.
This replaces the Play-only canvas counter that the Map button obscured.

Gems use ordinary authoritative actors, replication, durable origin identities
and deletion tombstones. Collected gems do not respawn on travel, chunk re-entry
or reload. Added gem identities can populate previously seeded chunks, including
visited rooms, without reseeding their residents or wildlife. Existing terrain,
props and other actor identities are preserved. Classic/Island ambient spawning
keeps its existing behavior; regional collection does not enable hostile spawns.

Each player carries the latest balance between a building and its parent world,
including when an older room visit has a saved balance. Separate outdoor worlds
keep their own progress. Normal player/location persistence restores the balance
on restart. Co-op gems are shared world pickups: the player who collects a gem
receives it, and it disappears for everyone.

## Implementation and evidence

- `src/generation/ExplorationGems.ts`: bounded outdoor placement and dry/clear checks.
- `src/ui/GemHUD.ts` / `GemHUD.css`: scene-independent, responsive progress display.
- `src/interiors/InteriorGems.ts`: seeded interior caches and reachable floor search.
- `Generator`, `Realm`, `RealmTransitions`: ordinary actor admission, old-chunk
  additions and shared indoor/outdoor balance.
- `ExplorationGems.test.ts`: parking/pond/lake and farm/woodland/clearing/green/
  station/picnic finds, negative coordinates, query-order/fresh-planner stability,
  safe dry ground, indoor layouts and usable floor.
- `RealmBrowser.test.ts`: native GameServer collection, visit/restart persistence,
  tombstones and the latest balance winning over older visit data.
- `base-game.test.ts`: pickup, values, invincibility, guest collection and single
  awards when multiple players overlap the same gem in a simulation snapshot.
- `tests/smoke.spec.ts` checks the visible zero total, real Worker pickup update,
  Play/Edit continuity, separation from Map, phone/landscape/desktop layouts,
  larger totals and renderer replacement in one browser boundary.
- `WorldAPI` resolves overlap participants by their actual player entity, so co-op
  guests use their own progress rather than the realm's first player's session.

Validation: focused native generation, base-game, WorldAPI and GameServer tests,
all TypeScript projects, changed-file lint and `git diff --check` pass. The isolated
bundled-Chromium streaming benchmark passes `--assert-ready`. Art catalog and
Workshop manifest are regenerated through the normal scripts.

## Next decisions

Playtest discovery rate before setting prices. A first shop could sell permanent
character cosmetics, vehicle paint choices or home decorations. Decide whether
co-op should share a wallet or keep individual balances, and whether later content
needs repeatable earning. No shop, prices, unlock gates or reset timers are added
by this collection slice.
