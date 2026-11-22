import {
  clockLabel,
  type ForecastEntry,
  forecast,
  type SkyClockView,
  skyAt,
  type WeatherKind,
} from "../sky/Sky.js";

export type PhoneIcon = "sun" | "moon" | "cloud" | "rain" | "storm";

export interface PhoneWeather {
  readonly icon: PhoneIcon;
  readonly label: string;
}

export interface PhoneScreen {
  /** "8:05 AM" */
  readonly time: string;
  /** "Day 3" */
  readonly day: string;
  /** The screen's backdrop follows the sky outside. */
  readonly sky: "day" | "dusk" | "night";
  readonly now: PhoneWeather;
  /** The weather periods after the current one. */
  readonly later: readonly (PhoneWeather & {
    /** "3 PM", "Noon", "Midnight" */
    readonly when: string;
    /** The first row of the next day. */
    readonly tomorrow: boolean;
  })[];
}

/** Rows of forecast after the current weather. */
const LATER = 4;

/** Names for the weather now, and shorter ones for the forecast's rows. */
const NOW: Record<WeatherKind, string> = {
  clear: "Sunny",
  cloudy: "Cloudy",
  rain: "Rainy",
  storm: "Thunderstorm",
};
const LATER_NAMES: Record<WeatherKind, string> = {
  clear: "Sunny",
  cloudy: "Cloudy",
  rain: "Rain",
  storm: "Storm",
};

function weather(kind: WeatherKind, night: boolean, names = NOW): PhoneWeather {
  if (kind === "clear")
    return night
      ? { icon: "moon", label: names === NOW ? "Clear night" : "Clear" }
      : { icon: "sun", label: names.clear };
  return { icon: kind === "cloudy" ? "cloud" : kind, label: names[kind] };
}

function hourName(hour: number): string {
  if (hour === 0) return "Midnight";
  if (hour === 12) return "Noon";
  return `${hour % 12} ${hour < 12 ? "AM" : "PM"}`;
}

function later(entry: ForecastEntry, today: number, previous: ForecastEntry | undefined) {
  return {
    ...weather(entry.kind, entry.night, LATER_NAMES),
    when: hourName(entry.hour),
    tomorrow: entry.day > today && (previous?.day ?? today) === today,
  };
}

/** What the phone shows for a world's clock. */
export function phoneScreen(clock: SkyClockView): PhoneScreen {
  const sky = skyAt(clock.seed, clock.time, clock.held);
  const periods = forecast(clock.seed, clock.time, LATER + 1);
  return {
    time: clockLabel(sky.hour),
    day: `Day ${sky.day}`,
    sky: sky.daylight > 0.75 ? "day" : sky.daylight > 0.2 ? "dusk" : "night",
    now: weather(sky.kind, sky.daylight < 0.5),
    later: periods.slice(1).map((entry, index) => later(entry, sky.day, periods[index])),
  };
}
