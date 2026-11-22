# 268 Day, night and weather

Status: delivered · 2026-11-22. Owner request: day and night, weather that is
sometimes rainy and sometimes a storm with heavier rain and lightning, and a
phone that shows the time and the weather forecast.
Owner: [day, night and weather](../topics/day-night-and-weather.md), which holds
the player-facing behaviour, contracts, gaps and next work.

## What changed

- **A world clock and a pure sky.** `sky/Sky.ts` turns a world seed and a clock
  time into daylight, tint, cloud, rain and lightning, and into the forecast.
  `server/SkyClocks.ts` keeps one clock per world, shared with its building
  interiors, advanced once per server tick while someone is in the world and
  saved in each realm's meta (`skyTime`).
- **Replication.** `sync-sky` gives a replica the seed, the time at a realm tick
  and held weather; frame ticks keep it current (`sky/SkyReplica.ts`). It is a
  server message outside the buffered sync union, applied on arrival.
- **The look.** `FirstPersonAtmosphere` draws after everything else in a view:
  a multiply by the tint with a lantern's light around each player, then rain
  streaks, ground splashes (top-down) and the lightning flash. Top-down, first
  person and split screen share it. A clear day adds no draw call.
- **The sound.** `WeatherAudio` synthesizes a rain loop and thunder per strike.
- **The phone.** `ui/Phone.ts` and `ui/phoneScreen.ts`: clock, day, weather now
  and four forecast rows, with pixel icons drawn as SVG. It is a display that
  takes no input. `toggle_phone` is **P**, **R3** on a pad and the button beside
  the gear.
- **Commands.** `time` and `weather` on the server console, for parents and tests.

## Decisions

- **Weather is deterministic, not simulated.** A forecast then needs no state,
  replicas need no weather messages, and lightning is simultaneous for free.
- **The tint is a pass over the view, not a change to materials.** The scene has
  many patched materials, cached terrain rasters and two shadow maps. One pass
  covers all of them and costs nothing by day. It cannot move the sun's shadows.
- **One game hour per real minute.** A whole day fits a play session, and a
  weather period lasts three minutes.
- **Night stays readable.** The darkest tint keeps about 45% of the light, and
  each player carries a lantern. The audience is young children.
- **The clock only moves forward.** Each realm of a world saves the time it saw,
  and the latest wins on load. `time` therefore moves to the next such hour.
- **The first morning is clear** until noon of day 1, so a new world and the
  browser suite start in plain daylight. Worlds saved earlier start there too.
- **Labs have no sky.** Only a server's `RealmDirectory` gives realms clocks.
- **Build mode is drawn in daylight** so painted colours read true.
- **The phone is not a menu.** It needs no focus handling and play continues, so
  a controller needs only a toggle. R3 was the one free pad button.

## Size ratchet

Six baselined files grew, by wiring only: `Realm` +7, `FirstPersonView` +7,
`GameServer` +4 (`skyOf`), `GameClient` +4, `ClientStateView` +4,
`AudioManager` +3 (`output`). The logic is in new collaborators (`SkyClocks`,
`SkyReplica`, `ClientSky`, `FirstPersonAtmosphere`, `playAtmosphere`,
`WeatherAudio`). The baseline was raised for these six entries only.

## Validation

- Native: the sky's determinism, first-morning rule, forecast against the
  weather that follows, gradual turns, storm rule and lightning bounds
  (`Sky.test.ts`); clock sharing, saved-time merge, one `sync-sky` per stream,
  the commands and the saved meta on a memory server (`SkyClocks.test.ts`); the
  replica's clock across a realm change (`SkyReplica.test.ts`); the phone's
  screen (`phoneScreen.test.ts`); the pad's R3 (`ControllerInput.test.ts`);
  lanterns, rooms and headsets
  (`playAtmosphere.test.ts`); play, no clock and build mode
  (`firstPersonPlay.test.ts`); the pass's place in the frame and its absence on
  a clear day (`FirstPersonView.test.ts`, with a renderer that draws nothing).
- Seen in bundled Chromium against an isolated Vite server (1,280 × 800, a new
  world): day, sunset, night with the lantern, rain and a storm top-down; a
  night storm in first person; the phone by day, at dusk and in a night storm,
  opened by its key, its button and a scripted pad's R3, with the clock running
  under it.
- Not seen or measured: a room, split screen, a headset, a touch device, a
  Steam Deck, the sounds (no audio in the headless run), a P2P guest and a
  dedicated server. Frame cost was not benchmarked.
