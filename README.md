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

## Steam Deck / desktop package

Build the bundled Linux game with `npm run desktop:build:linux`, then use
`npm run deck:doctor`, `npm run deck:install`, and `npm run deck:launch` with a
local [machine-control](../machine-control/) checkout. Gaming Mode lists it as
**Devkit Game: tilefun**. The package uses Chromium GPU rendering and includes
all single-player assets and the authority Worker. Saves live in Electron's
stable user-data directory, independently of package upgrades.

The shared menu now separates **Resume**, **Worlds**, **Multiplayer**, **Options**
and **Character**. Create/manage worlds inside Worlds; host, enter an invitation
code/link, or browse public games inside Multiplayer. Hosting/joining flushes local
saves first. Online play requires signaling and a working peer connection.

| Control | Action |
| --- | --- |
| Left stick | Move; pan while building |
| A / B | Jump or select / contextual actions or back |
| Menu / View | Pause menu / world map |
| Y / X | Interact or editor tools / throw |
| LB / RB | Build–Play / horn |
| RT | Sprint; paint/place while building |
| Right stick / LT | Building cursor / erase |
| Driving | Aim behind to reverse; optional Up/Down forward/reverse and Left/Right steering in Options |
| D-pad ↑ / → | Vehicle lights / siren style (L / K on keyboard) |

D-pad/stick focus, A select, B back and an on-screen text keyboard cover game
menus and editor tools. **Save and quit** flushes the authority before closing.
The right-stick cursor also selects visible tools and map controls with A or RT.
Vehicle equipment (tow, cargo and dump bed) opens through **B / Q / Actions**,
with D-pad/stick selection, A confirmation and B back. Named action paddles show
the current keyboard/controller hints; vehicle controls
never reuse Jump and Throw. Touch maps support two-finger pan and zoom.
Browser saves and packaged saves are separate. See
[Steam Deck and menus](docs/topics/steam-deck-and-menus.md) for runtime, installation
and acceptance details.

## Features

City speedways now have a **Vehicle depot** in the infield: a transporter, tow
truck, dump truck, cars and a practice bridge. Look for the **orange truck icon**
and named destination button in **Map · G / controller View**. Transporter steel
ramps and decks support ordinary walking and standing passengers.
[Depot controls and generation](docs/vehicle-depot.md).

Regional worlds now include large wildlife lakes with an explorer motorboat
beside the northern shore. Press **E / Drive boat** to board, steer with ordinary
vehicle controls, and return beside a clear shore to get out. Boats are also in
**Edit → Vehicles**. [Boat controls and lake generation](docs/topics/boats.md).

The game defaults to **GPU + 3D car**: the existing fixed game view rendered with
WebGL2, with all 45 authored vehicle models: compact cars, sedans, buses, police,
ambulance, firetrucks and garbage trucks. Models load as needed; sprites remain
available while loading or if a model cannot load.
Choose **☰ → Debug → Renderer** (or F3) to switch to Canvas or GPU sprites.
`?renderer=canvas` selects Canvas explicitly; unsupported WebGL2 also falls back
to Canvas. This does not enable the separate 3D collision view or spatial VR.

- **Multiplayer** — Peer-to-peer via WebRTC (one browser hosts, others connect via URL — no server needed) or run a zero-dependency dedicated Node server. Parent crafts the world while the kid plays in it
- **Collaborative editing** — See other players' editor cursors in real time, paint terrain together
- **Find your co-op players** — Small pointers and names mark nearby players; subtle screen-edge arrows point toward players outside your view in the same realm, in Play and Edit
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

Use the **⚙ Options** button beside the hamburger to choose **Tap to move**, **Hold to move** or
**Joystick**. The same Options panel is available from the hamburger and main
menu. The choice is remembered for each local player on this browser; Joystick
remains the default. In Tap to move, tap a place and lift your finger to walk
straight toward the yellow destination ring. Tap somewhere else to redirect,
or near your character's feet to stop. Obstacles stop the walk; this first
version does not find a route around them. Tapping a befriendable animal still
interacts with it. Jump, Throw and Sprint remain available on foot, alongside
keyboard and gamepad controls. Menus, editing, travel and focus loss cancel the destination.
In Hold to move, put a finger down in the direction you want to go and keep it
held. Move the finger to steer; lift to stop. The newest world finger steers,
and lifting it returns control to the newest finger still held. No completed
tap is required. Jump/Throw/Sprint touches do not take over steering. The same
menu, travel and focus changes cancel the hold, requiring a fresh finger-down.
See [touch movement](docs/topics/touch-movement.md) and [tap movement and Options](docs/tactical/086-tap-to-move-and-options.md)
for the behavior and remaining device trial.

**Car transporter** in Edit → Vehicles has working loading equipment. Open **Actions (B / Q / touch)** to deploy the ramp, drive a passenger car aboard, get out and secure it, then stow the ramp before driving the truck. Stop, deploy and release to reverse the same car off. See [operation and authoring](docs/vehicle-transporter.md).

**Edit → Vehicles** lets you choose any of the 45 vehicles and click/tap clear dry
ground to place it parked, including in existing worlds without roads. **Vehicles
→ Delete** removes one by tapping its body. Placed vehicles stay parked after you
get out and save their position, lights and occupied driver seat.

In Play mode, stand beside a stopped vehicle and tap **Drive car / Drive train · E**
(or press E). Your character disappears inside; other players can ride visibly on
its roof. Cars use ordinary directional movement controls, including diagonals, or a
Tap-to-move destination. The nose turns along a curved rolling path: it cannot
pivot at rest or slide sideways. Aim substantially behind the car to reverse at
half speed; guide the direction around its side to turn forward. **Options → Car
controls** also offers Up/Down forward/reverse with Left/Right steering for keys,
controller and joystick. Tap and hold destinations still aim where to drive with
either choice. Longer vehicles need wider turns. Trains stay on their track: up/right moves one way,
down/left the other. In tap mode, tap the right/left half of the screen to start;
tap the same side again to stop. In Hold to move, hold the right/left half
to travel and lift to stop; cars steer toward the held finger. **Get out · E**
stops and finds clear ground.
Off-road cars stay parked and saved; cars on suitable roads resume traffic.
See [vehicle driving](docs/tactical/087-player-driven-cars-and-trains.md). Driving keeps on-screen action buttons visible even on desktop:
hold **Fast / Shift** to go faster and hold **Horn / H** to honk for as long as you
hold it (**Whistle / H** in trains). Release to stop.
Sportier cars drive faster; buses and heavy trucks accelerate more slowly. Driven
cars and all trains gently nudge players and movable animals/balls, with stronger
pushing from heavier vehicles. A blocked push stops the vehicle. Driven cars and
trains run over small wildlife such as frogs, rabbits and grounded birds, leaving
still, flattened remains that disappear after 30 seconds. Pets and following/ridden
animals stay protected; other bodies retain gentle pushing. Automatic road traffic
keeps yielding. In an ambulance, police car or firetruck, **Siren / L / D-pad Up** toggles flashing
lights and sound; **Style / K / D-pad Right** cycles EU-style two-tone, US-style wail and
lights-only. Garbage trucks use **Beacon / L / D-pad Up** for silent amber lights.
Try any of the 45 vehicle choices in the Traffic playground.


Moving trains chug and clatter faster as they speed up, with a two-part whistle
on departure and during the journey. Nearby trains sound louder; stopped trains are quiet.

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
to fall normally. **Horses are rideable:** jump onto their back to mount, use
movement controls to ride quickly, hold Sprint to go faster, and press Jump to
get off. Their back is reachable with the default jump and gravity; riding also
works on existing saved horses.
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

Fresh regional cities also have large oval speedways on clear outskirts, linked
to the outer boulevard. Eight sports cars race around two lanes beside checkered
markings, red/white kerbs, spectator seating and picnic areas. Cars brake for
people; stopped cars can be driven normally. Look east or west of a city, or
choose **City outskirts · oval speedway** in the Workshop's World Geometry tool.
Use a fresh world to inspect the new generation.

## Characters

Open **Edit → Entities** to place Tiger, Tuxedo Cat, Floppy Dog, Trail Explorer,
Russet Squirrel and Brown Bear. They wander using their approved Workshop settings.
Choose **Character** in the main menu for animated player previews; your choice
is remembered per browser profile and visible to co-op players. Model choice
keeps the same player movement and collision rules.

## Play ideas

Open the game menu, then **More → Idea**. Hold the big button to speak, allowing
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
