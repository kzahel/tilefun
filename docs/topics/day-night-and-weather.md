# Day, night and weather

Topic: day-night-and-weather
Status: first version delivered 2026-11-22
([268](../tactical/268-day-night-and-weather.md)); owner play review and device
runs pending.
Updated: 2026-11-22.

Owns the world's clock, the sky it produces (daylight, cloud, rain, storms and
lightning), how replicas show and sound it, and the player's phone.

## What players get

- **Days.** A game hour passes in a real minute, so a day is 24 minutes. A new
  world starts at 8 AM on day 1. Night runs from 8 PM to 4:30 AM, with a pink
  dawn until 7 AM and an orange sunset from 5:30 PM.
- **Night.** The world is tinted blue and darker. Each player carries a lantern:
  a warm circle of normal light around them, so play stays readable. In first
  person the lantern lights the middle of the view.
- **Weather.** Clear, cloudy, rain or a thunderstorm, chosen for every three
  game hours and turning gradually into the next. About half of the periods are
  clear. A storm follows cloud or rain, never a clear sky. A new world stays
  clear until noon of its first day.
- **Rain and storms.** Rain falls over the view and splashes on the ground in
  the top-down view. Storms rain harder, dim the day and strike lightning every
  several seconds: a soft double flash, then thunder that comes later and
  quieter the farther the strike is. Rain has a continuous sound.
- **Indoors.** Rooms are lit and dry: a light share of the outdoor tint, no rain,
  and muffled rain and thunder.
- **The phone.** The phone button beside the gear, **P** on the keyboard or
  **R3** (right stick click) on a controller brings up a phone showing the
  time, the day, the weather now and the forecast for the next four periods.
  It takes no input: play continues under it, and touches pass through it. The
  same button, key or stick click puts it away.
- **Building.** Build mode shows the world in plain daylight so painted colours
  read true. The clock, the phone and the sounds carry on.
- **Commands.** `time` shows the clock; `time night` or `time 14` moves it forward
  to the next such hour (words: dawn, morning, noon, evening, night, midnight).
  `weather` shows the weather and forecast; `weather storm` (or `clear`, `cloudy`,
  `rain`) holds one kind until `weather auto`. Held weather is not saved.

## Contracts

- **The sky is a pure function.** [`sky/Sky.ts`](../../src/sky/Sky.ts) gives the
  sky for a world seed and a clock time: daylight, tint, cloud, rain, the flash
  of lightning and the list of strikes. Authority, every replica and the
  forecast evaluate the same function, so the forecast is the weather that
  happens and every player sees a strike at the same moment. Changing a
  constant there changes every world's weather.
- **One clock per world, on authority.** [`SkyClocks`](../../src/server/SkyClocks.ts)
  keeps one clock per world id. A building interior uses its parent world's.
  The clock advances once per server tick while a player is in any of the
  world's realms, and only forward: `time` moves it to the next such hour.
- **Saving.** Each realm writes the clock into its own saved meta (`skyTime`)
  every 20 seconds while it has players. On load a clock takes the latest time
  any of the world's realms saved. A reload can lose up to 20 seconds. Worlds
  saved before this start at 8 AM on day 1.
- **Replication.** One `sync-sky` message per stream gives the seed, the clock
  time at a realm tick and any held weather. Frames already carry the realm's
  tick, which keeps the replica's clock current
  ([`SkyReplica`](../../src/sky/SkyReplica.ts)). It is sent again when a command
  moves the clock or holds weather, or the two drift by a quarter second.
- **Presentation.** The 3D scene draws the sky last
  ([`FirstPersonAtmosphere`](../../src/rendering/firstperson/FirstPersonAtmosphere.ts)):
  one full-view multiply by the tint, lifted around lanterns, then one pass of
  rain and lightning. A clear day draws neither. The frame's `atmosphere`
  ([`sky/Atmosphere.ts`](../../src/sky/Atmosphere.ts)) is built per view by
  [`playAtmosphere`](../../src/scenes/playAtmosphere.ts). Materials, the sun's
  shadow maps and cached terrain are unchanged: the sun does not move.
- **Flashes are soft.** A strike is two slow pulses, at most 42% white over the
  view, at most one strike per five seconds. Do not turn it into a strobe.
- **Sound.** [`WeatherAudio`](../../src/audio/WeatherAudio.ts) makes rain and
  thunder from noise; there are no recordings. It follows the game's master
  volume and stops while the page is hidden.
- **Labs and tests.** A realm has a sky only where a server's `RealmDirectory`
  gives it clocks. Workshop labs, recipe worlds and scenario sessions have none
  and show plain daylight, so review captures do not change with time.

## Known gaps

- The sun's shadows do not move or fade with the hour, and they stay at night.
- Lamps, windows and vehicle lights do not light the night; only players do.
- A headset gets the tint and the flash, but no rain and no lanterns: both are
  placed on a flat screen. Not seen in a headset.
- Split screen and the shared screen show one phone, seat 0's. Only seat 0's
  key, pad or the button opens it.
- Weather changes nothing in the simulation: crops, animals and traffic ignore
  it, and nobody sleeps.
- Rain falls over roofs and under bridges in the top-down view.
- Not measured on the Steam Deck, a phone or a Chromebook. The pass is two
  full-view draws in rain at night and none on a clear day.

## Next

- Owner play review of the look and pacing: day length, how dark night is, how
  often it rains, thunder loudness.
- Phone controls for a creative world (make it rain, skip to morning), with a
  decision on who may use them in multiplayer.
- Lights at night: street lamps, windows and headlights as more lanterns.
- Gameplay that follows the sky: rain watering crops, animals sheltering,
  sleeping through the night.
- Seasons, as [ideas](../ideas.md) suggests.
