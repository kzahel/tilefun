# Tilefun

**Mario Maker meets Zelda, for little kids, extensible with AI.**

A creative-mode-first 2D tile game — paint terrain, place entities, hit play, and live in the world you built. Seamless edit/play toggle, no scripting required. Designed for young children and parent co-op.

**Play it live:** https://kyle.graehl.org/tilefun | **Dev log:** https://kyle.graehl.org/tilefun-devlog/

<video src="https://github.com/user-attachments/assets/038140dd-e987-4f71-8ec4-8fa5425dba1d" controls muted playsinline width="400"></video>

## Documentation

Start with the [docs map](docs/README.md), [roadmap](docs/ROADMAP.md) or
[ideas and playtester backlog](docs/ideas.md). [Topics](docs/topics/README.md)
track current decisions and next work; [tacticals](docs/tactical/README.md)
record bounded implementation plans. Agent guidance lives in [AGENTS.md](AGENTS.md).

## Development setup

The runtime art and tool assets are checked in; a fresh clone can run without
restoring the original downloaded packs. See [Fresh-machine setup, assets and
local data](docs/setup-and-local-data.md) for dependency installation, build/test
commands, source-pack rebuilds, and transferring review history and local state.

Single-player authority runs in a dedicated Worker; the main thread handles the
client replica, prediction and rendering. Run `npm run streaming:bench -- --assert-ready`
for isolated real-game traversal checks, or add `--headed` / `--cpu=4` for other
measurement lanes. Physical Android testing supports `--cdp` and `--touch`;
see the [performance plan, setup and recorded results](docs/tactical/012-streaming-performance-and-local-server-worker.md).

## Tilefun Workshop

[Open Workshop](https://tilefun.graehlarts.com/tilefun/workshop.html) for the
global review inbox, source-art annotations, requests, history and all tools.
Owner login protects feedback. See [Workshop usage, setup and API](docs/tilefun-workshop.md).

## Features

- **Multiplayer** — Peer-to-peer via WebRTC (one browser hosts, others connect via URL — no server needed) or run a zero-dependency dedicated Node server. Parent crafts the world while the kid plays in it
- **Collaborative editing** — See other players' editor cursors in real time, paint terrain together
- **Configurable physics** — QuakeWorld-style friction and acceleration system. Tune CVars per-surface for ice skating, bouncy floors, or set friction/accel to 100 for traditional RPG movement. Mario-style stomp and bunny hopping built in
- **2.5D height system** — 3D AABB collisions, walkable surfaces, cliff-edge falling, stair-step props, and a debug 3D renderer for visualizing collision volumes
- **Client-side prediction** — Input replay reconciliation for responsive movement even over high-latency connections, including mount prediction
- **Interactive entities** — Birds, fish, chickens, cows, campfire, ball, and more — ride mounts, stomp enemies, befriend animals that follow you, collect gems
- **Full terrain editor** — 26 terrain types with blob autotile (47-variant bitmask) on a dual-grid system, roads, sidewalks, elevation tiles, and procedural road network generation
- **Props** — Placeable objects on terrain (trees, playground structures, stairs) with 3D collision
- **Quake-style debug console** — CVars, commands, tab completion, and RCON protocol for remote server control
- **Audio and particles** — Sound effects and visual particle system
- **Touch and gamepad** — On-screen touch controls and optional gamepad support for mobile and controllers
- **Roblox-inspired experience API** — Streamlined server-side scripting with tags, events, tick hooks, and overlap detection. Core sample experiences demonstrate the API; creative sandbox is the base gameplay mode. See the [vision doc](docs/VISION.md) for the full roadmap (creature collector, farming sim, tycoon, and more)
- **Player profiles & persistence** — Worlds and player data saved to IndexedDB in the browser, or to disk when running the dedicated Node server

On touch-first devices, the first tap requests fullscreen when the browser supports
it, while still performing the tapped action. There is no extra button. Exiting
fullscreen keeps it off until the next page load; unavailable or denied fullscreen
leaves the game playable in the browser. This does not disable OS navigation gestures.

Use the **⚙ Options** button beside the hamburger to choose **Tap to move** or
**Joystick**. The same Options panel is available from the hamburger and main
menu. The choice is remembered for each local player on this browser; Joystick
remains the default. In Tap to move, tap a place and lift your finger to walk
straight toward the yellow destination ring. Tap somewhere else to redirect,
or near your character's feet to stop. Obstacles stop the walk; this first
version does not find a route around them. Tapping a befriendable animal still
interacts with it. Jump, Throw and Sprint remain available on foot, alongside
keyboard and gamepad controls. Menus, editing, travel and focus loss cancel the destination.
See [tap movement and Options](docs/tactical/086-tap-to-move-and-options.md)
for the behavior and remaining device trial.

In Play mode, stand beside a stopped vehicle and tap **Drive car / Drive train · E**
(or press E). Your character disappears inside; other players can ride visibly on
its roof. Cars use ordinary movement controls, including diagonals, or a straight
Tap-to-move destination. Trains stay on their track: up/right moves one way,
down/left the other. In tap mode, tap the right/left half of the screen to start;
tap the same side again to stop. **Get out · E** stops and finds clear ground.
Off-road cars stay parked and saved; cars on suitable roads resume traffic.
See [vehicle driving](docs/tactical/087-player-driven-cars-and-trains.md).

Waiting for a train? Go beside or onto a station bench in Play mode and tap
**Call train · E** (or press E). The same train appears immediately at that station
and waits eight seconds to let you board. If someone is driving or riding it,
call again after they get off. The station track must be clear and intact.

The editor tray uses at most half the visible screen, including its header and
tabs. Swipe the category tabs horizontally and scroll the palette vertically;
the tabs stay visible while browsing. Tap the selected-item header to minimize
the tools and keep placing items, then tap it again to expand. **Play** (or Tab
on a keyboard) exits editing. The Sprite Atlas has a separate close button that
returns to editing without opening the mobile keyboard automatically.
`tests/mobile-editor.spec.ts` checks portrait and landscape layouts, palette
scrolling, placement with minimized tools, and returning from the Atlas.

Install Tilefun from Chrome's menu (**Install app** / **Add to Home screen**) for a
home-screen icon that opens the game without browser controls. On iPhone or iPad,
use Safari's **Share → Add to Home Screen**. The shortcut starts the main game,
not a temporary multiplayer invitation. Mobile first-tap fullscreen still applies.
This is an online launcher: there is no service worker, offline download or custom
asset cache, and installation does not sync saved worlds across devices. The app
manifest and launch paths stay within `/tilefun/`. Launcher icons reuse the favicon;
regenerate them with `npm run assets:app-icons` when it changes.
Launcher checks cover both Vite dev serving (used by the live site) and production
preview; public-asset links let Vite apply the deployment prefix exactly once.

## Wildlife

Regional ponds have small seeded duck and frog populations using existing provisional
art. Ducks waddle, swim, rest, quack and exercise their wings; frogs hop with real
push-off/landing phases, swim, rest, blink and croak around grassy banks.
Solitary foxes roam woodland clearings, pause to investigate and flick their tails.
Cats and dogs explore rural clearings with cautious player interest. Small cow,
sheep, horse, pig and goat groups walk in wider pastures, rest and play native
ear/tail actions. Elephant and giraffe groups use broad clearings; kangaroos
hop with real push, flight and landing. Cobras slither harmlessly and small ant
colonies crawl around woodland homes. Species have different speeds, spacing and
home ranges.
Ponds have swimming fish; broad sandy water refuges host waddling/swimming
penguins, hauling/swimming seals and deep-water rays. Shore animals change gait
at the actual waterline. Their native actions and movement phases survive reload.
Woodland glades also have small seeded rabbit groups that hop, rest and play quiet
action cycles. Robins hop and rest on dry woodland ground, fly to oak/palm crowns,
and perch or sing before returning to ground. Small deer groups inhabit wider
woodland glades, walking, pausing and playing ear/tail alert cycles; nearby members
react together to a scare. Their bodies have collision and support standing; landing never
automatically launches the player. Landing contact or a ball hit makes animals
escape briefly and settle. Press Jump to jump off; moving animals can leave you
to fall normally.
They persist as individuals when you leave and return; deleted animals stay gone,
with no timed respawns. **Edit → Entities** offers all 22 wildlife species and
creates saved individuals, including in older worlds whose countryside chunks
were already seeded. New populations and habitat changes appear in fresh areas.
Try the [frog pond playground](https://tilefun.graehlarts.com/tilefun/workshop.html?geometry=nature-frogs&landscape=thicket#/tool/world-geometry)
and its **Hop onto frog** / **Hop onto duck** controls, or the
[robin grove](https://tilefun.graehlarts.com/tilefun/workshop.html?geometry=nature-robins&landscape=thicket#/tool/world-geometry)
for tree perching and short flights. The
[deer glade](https://tilefun.graehlarts.com/tilefun/workshop.html?geometry=nature-deer&landscape=thicket#/tool/world-geometry)
shows grounded deer groups and brief escapes. The
[water refuge](https://tilefun.graehlarts.com/tilefun/workshop.html?geometry=nature-manta-ray&landscape=thicket#/tool/world-geometry)
frames the ray and shore groups, while the
[kangaroo meadow](https://tilefun.graehlarts.com/tilefun/workshop.html?geometry=nature-kangaroo&landscape=thicket#/tool/world-geometry)
shows physical hops. Other native species arrivals are in the Scene selector.

Fresh worlds also have connected farmsteads: dirt lanes branch from inter-town
roads to a farmhouse, shed, crops and durable pasture animals. Cities have larger
16- or 24-block neighborhoods, taller centers, shopping streets and two greens;
villages stay compact. Cats and dogs live in safe settlement greens and persist
as individuals. Fresh settlement greens choose among tuxedo, ginger tabby and
black cats, plus tricolor, golden retriever and pointed-ear shepherd dogs.
**Edit → Entities** also offers all four new pet variations for older worlds.
Their new art remains pending review in the
[Wildlife gallery](https://tilefun.graehlarts.com/tilefun/demos/wildlife-v2/).
Inspect the [farmstead](https://tilefun.graehlarts.com/tilefun/workshop.html?geometry=nature-farmstead&landscape=thicket#/tool/world-geometry),
[village pets](https://tilefun.graehlarts.com/tilefun/workshop.html?geometry=nature-village-pets&landscape=thicket#/tool/world-geometry),
[city pets](https://tilefun.graehlarts.com/tilefun/workshop.html?geometry=nature-city-pets&landscape=thicket#/tool/world-geometry)
or [city center](https://tilefun.graehlarts.com/tilefun/workshop.html?geometry=nature-city-center&landscape=thicket#/tool/world-geometry)
in temporary worlds with walking and Save / reload controls.

## Characters

Open **Edit → Entities** to place Tiger, Tuxedo Cat, Floppy Dog, Trail Explorer,
Russet Squirrel and Brown Bear. They wander using their approved Workshop settings.
Choose **Character** in the main menu for animated player previews; your choice
is remembered per browser profile and visible to co-op players. Model choice
keeps the same player movement and collision rules.

## Play ideas

Open the game menu and choose **💡 Idea**. Hold the big button to speak, allowing
microphone access if the browser asks. Release to turn off the microphone and
finish the words. Tap the resulting words to hear them aloud;
**Try again** replaces them and **Send** sends the text plus a picture of the game.
Tilefun stores no audio. Browser speech support varies; typing is also available.
Unsent ideas stay on the device and retry while the game is open. Submitting needs
no login; the owner reviews them privately in
[Workshop → Play ideas](https://tilefun.graehlarts.com/tilefun/workshop.html#/play-ideas).
See [Play ideas](docs/topics/play-ideas.md) for storage, limits and browser details.

## Asset Credits

- **Modern Exteriors** by LimeZu — [itch.io](https://limezu.itch.io/modernexteriors)
- **Modern Interiors** by LimeZu — [itch.io](https://limezu.itch.io/moderninteriors)
- **Sprout Lands** by Cup Nooble — [itch.io](https://cupnooble.itch.io/sprout-lands-asset-pack)
