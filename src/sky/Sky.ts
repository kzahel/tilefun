// Day, night and weather as pure functions of a world's seed and its clock.
// Authority owns the clock; every replica evaluates the same sky from it, so a
// forecast is the weather that will happen and lightning strikes for everyone at
// the same moment. Changing a constant here changes every world's weather.

/** Real seconds in one game day: a game hour passes in a real minute. */
export const DAY_SECONDS = 24 * 60;
const HOUR_SECONDS = DAY_SECONDS / 24;
/** A new world's clock starts here: 8 in the morning of day 1. */
export const START_SECONDS = 8 * HOUR_SECONDS;
/** Weather is chosen once per period of this many game hours. */
export const WEATHER_HOURS = 3;
const PERIOD_SECONDS = WEATHER_HOURS * HOUR_SECONDS;
/** A new world stays clear until noon of its first day. */
const FIRST_WEATHER_PERIOD = 12 / WEATHER_HOURS;
/** Half the share of a period over which weather turns into its neighbour's. */
const TURN = 0.08;
/** At most one lightning strike per window of this many seconds. */
const STRIKE_WINDOW = 5;

export const WEATHER_KINDS = ["clear", "cloudy", "rain", "storm"] as const;
export type WeatherKind = (typeof WEATHER_KINDS)[number];

/** How much of each a kind of weather brings, 0–1. */
interface Levels {
  readonly cloud: number;
  readonly rain: number;
  readonly thunder: number;
}
const LEVELS: Record<WeatherKind, Levels> = {
  clear: { cloud: 0, rain: 0, thunder: 0 },
  cloudy: { cloud: 0.6, rain: 0, thunder: 0 },
  rain: { cloud: 0.8, rain: 0.55, thunder: 0 },
  storm: { cloud: 1, rain: 1, thunder: 1 },
};

export type Rgb = readonly [number, number, number];

/** A world's clock as a replica knows it. */
export interface SkyClockView {
  readonly seed: number;
  /** Seconds on the world's clock. */
  readonly time: number;
  /** Weather kept by a command instead of the seed's own. */
  readonly held: WeatherKind | undefined;
}

export interface SkyState {
  /** Days start at 1. */
  readonly day: number;
  /** Hour of the day, 0 up to 24. */
  readonly hour: number;
  /** 1 in full daylight, 0 in the middle of the night. */
  readonly daylight: number;
  /** The weather of the current period, or the one held by a command. */
  readonly kind: WeatherKind;
  readonly cloud: number;
  readonly rain: number;
  /** Brightness of a lightning flash right now, 0–1. */
  readonly flash: number;
  /** What the lit world is multiplied by: sunlight through the clouds. */
  readonly tint: Rgb;
}

/** A 0–1 value for an integer pair under a seed. */
function hash(seed: number, a: number, b: number): number {
  let h = (seed ^ Math.imul(a, 0x9e3779b1) ^ Math.imul(b, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 0x100000000;
}

function smooth(x: number): number {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}

/** The weather chosen for a period (period 0 starts at midnight of day 1). */
export function periodWeather(seed: number, period: number): WeatherKind {
  if (period < FIRST_WEATHER_PERIOD) return "clear";
  const roll = hash(seed, period, 1);
  // A storm grows out of rain or cloud, never out of a clear sky.
  if (roll < 0.48) return "clear";
  if (roll < 0.68) return "cloudy";
  if (roll < 0.86) return "rain";
  return periodWeather(seed, period - 1) === "clear" ? "rain" : "storm";
}

function weatherPeriod(time: number): number {
  return Math.floor(Math.max(0, time) / PERIOD_SECONDS);
}

function levelsAt(seed: number, time: number, held: WeatherKind | undefined): Levels {
  if (held) return LEVELS[held];
  // Between the middles of two periods, turning near their boundary.
  const position = Math.max(0, time) / PERIOD_SECONDS - 0.5;
  const before = Math.floor(position);
  const a = LEVELS[periodWeather(seed, before)];
  const b = LEVELS[periodWeather(seed, before + 1)];
  const k = smooth((position - before - (0.5 - TURN)) / (2 * TURN));
  return {
    cloud: a.cloud + (b.cloud - a.cloud) * k,
    rain: a.rain + (b.rain - a.rain) * k,
    thunder: a.thunder + (b.thunder - a.thunder) * k,
  };
}

/** Sunlight by hour: night, a pink dawn, day, an orange sunset, night. */
const LIGHT: readonly (readonly [number, Rgb, number])[] = [
  [0, [0.42, 0.48, 0.78], 0],
  [4.5, [0.42, 0.48, 0.78], 0],
  [5.75, [0.8, 0.66, 0.74], 0.5],
  [7, [1, 1, 1], 1],
  [17.5, [1, 1, 1], 1],
  [18.75, [1, 0.76, 0.58], 0.5],
  [20, [0.42, 0.48, 0.78], 0],
  [24, [0.42, 0.48, 0.78], 0],
];
/** What full cloud, and full rain under it, multiply daylight by. */
const OVERCAST: Rgb = [0.8, 0.83, 0.88];
const DOWNPOUR: Rgb = [0.74, 0.78, 0.86];

function sunlight(hour: number): { tint: Rgb; daylight: number } {
  let i = 1;
  while (i < LIGHT.length - 1 && (LIGHT[i] as (typeof LIGHT)[number])[0] <= hour) i++;
  const [h0, c0, d0] = LIGHT[i - 1] as (typeof LIGHT)[number];
  const [h1, c1, d1] = LIGHT[i] as (typeof LIGHT)[number];
  const k = (hour - h0) / (h1 - h0);
  return {
    tint: [c0[0] + (c1[0] - c0[0]) * k, c0[1] + (c1[1] - c0[1]) * k, c0[2] + (c1[2] - c0[2]) * k],
    daylight: d0 + (d1 - d0) * k,
  };
}

/** One lightning strike: when it flashes and how far away it is, 0 near to 1 far. */
export interface Strike {
  readonly time: number;
  readonly distance: number;
}

function strikeIn(seed: number, window: number, held: WeatherKind | undefined): Strike | undefined {
  const start = window * STRIKE_WINDOW;
  const { thunder } = levelsAt(seed, start, held);
  if (thunder <= 0 || hash(seed, window, 2) >= thunder * 0.6) return undefined;
  return {
    time: start + hash(seed, window, 3) * (STRIKE_WINDOW - 1),
    distance: hash(seed, window, 4),
  };
}

/** Strikes that flash in `[from, to)`, for thunder. */
export function strikesBetween(
  seed: number,
  from: number,
  to: number,
  held?: WeatherKind,
): Strike[] {
  const strikes: Strike[] = [];
  // A turned-back or far-jumped clock is not a storm's worth of thunder.
  if (!(to > from) || to - from > 4 * STRIKE_WINDOW) return strikes;
  for (
    let window = Math.floor(Math.max(0, from) / STRIKE_WINDOW);
    window * STRIKE_WINDOW < to;
    window++
  ) {
    const strike = strikeIn(seed, window, held);
    if (strike && strike.time >= from && strike.time < to) strikes.push(strike);
  }
  return strikes;
}

/** A flash and a dimmer second one: two slow pulses, not a strobe. */
function flashAt(seed: number, time: number, held: WeatherKind | undefined): number {
  const window = Math.floor(Math.max(0, time) / STRIKE_WINDOW);
  let flash = 0;
  for (const strike of [strikeIn(seed, window - 1, held), strikeIn(seed, window, held)]) {
    if (!strike) continue;
    const since = time - strike.time;
    if (since < 0 || since > 1.5) continue;
    const first = smooth(since / 0.06) * Math.exp(-since * 7);
    const second = since > 0.3 ? smooth((since - 0.3) / 0.06) * Math.exp(-(since - 0.3) * 6) : 0;
    flash = Math.max(flash, (first + 0.55 * second) * (1 - 0.5 * strike.distance));
  }
  return Math.min(1, flash);
}

/** The sky at `time` seconds on a world's clock. `held` is weather kept by a command. */
export function skyAt(seed: number, time: number, held?: WeatherKind): SkyState {
  const clock = Math.max(0, time);
  const hour = (clock % DAY_SECONDS) / HOUR_SECONDS;
  const { cloud, rain } = levelsAt(seed, clock, held);
  const sun = sunlight(hour);
  // Cloud dims the day more than the night, which is already dark.
  const dim = cloud * (0.45 + 0.55 * sun.daylight);
  const tint = sun.tint.map(
    (light, channel) =>
      light *
      (1 + ((OVERCAST[channel] as number) - 1) * dim) *
      (1 + ((DOWNPOUR[channel] as number) - 1) * rain * dim),
  ) as unknown as Rgb;
  return {
    day: Math.floor(clock / DAY_SECONDS) + 1,
    hour,
    daylight: sun.daylight,
    kind: held ?? periodWeather(seed, weatherPeriod(clock)),
    cloud,
    rain,
    flash: flashAt(seed, clock, held),
    tint,
  };
}

export interface ForecastEntry {
  /** Day and whole hour the period starts at. */
  readonly day: number;
  readonly hour: number;
  readonly kind: WeatherKind;
  /** The sun is down for most of the period. */
  readonly night: boolean;
}

/** The current weather period and the `count - 1` after it. */
export function forecast(seed: number, time: number, count: number): ForecastEntry[] {
  const first = weatherPeriod(time);
  return Array.from({ length: count }, (_, index) => {
    const period = first + index;
    const start = period * PERIOD_SECONDS;
    const hour = (start % DAY_SECONDS) / HOUR_SECONDS;
    return {
      day: Math.floor(start / DAY_SECONDS) + 1,
      hour,
      kind: periodWeather(seed, period),
      night: sunlight((hour + WEATHER_HOURS / 2) % 24).daylight < 0.5,
    };
  });
}

/** The clock time of the next `hour` o'clock strictly after `time`. */
export function nextHour(time: number, hour: number): number {
  const day = Math.floor(Math.max(0, time) / DAY_SECONDS);
  const today = day * DAY_SECONDS + hour * HOUR_SECONDS;
  return today > time ? today : today + DAY_SECONDS;
}

/** "8:05 AM". */
export function clockLabel(hour: number): string {
  const minutes = Math.floor(hour * 60) % (24 * 60);
  const h = Math.floor(minutes / 60);
  return `${h % 12 || 12}:${String(minutes % 60).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}
