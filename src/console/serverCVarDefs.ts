import type { CommandDesc } from "./Command.js";
import type { CVarDesc } from "./CVar.js";

/** Gravity is the sole public physics tuning option. Simulation uses one preset. */
export const SERVER_CVAR_DEFS: readonly CVarDesc[] = [
  {
    name: "sv_gravity",
    description: "Gravity multiplier (1 = normal, 0.5 = moon, 2 = heavy)",
    type: "number",
    defaultValue: 1,
    min: 0,
    max: 20,
    category: "sv",
  },
];

/** Words the `time` command takes for an hour of the day. */
export const TIMES_OF_DAY: Record<string, number> = {
  dawn: 6,
  morning: 8,
  noon: 12,
  evening: 18,
  night: 21,
  midnight: 0,
};
export const TIME_WORDS = Object.keys(TIMES_OF_DAY);
export const WEATHER_WORDS = ["auto", "clear", "cloudy", "rain", "storm"];

/** The world clock and weather commands, shared by the server and the client's stubs. */
export const TIME_COMMAND = {
  name: "time",
  description: "Show the world's clock, or move it forward to an hour (0-23) or time of day",
  args: [{ name: "to", type: "string", optional: true, completions: () => TIME_WORDS }],
  category: "sv",
  serverSide: true,
} satisfies Omit<CommandDesc, "execute">;
export const WEATHER_COMMAND = {
  name: "weather",
  description: "Show the weather and forecast, or hold one kind until 'weather auto'",
  args: [{ name: "kind", type: "string", optional: true, completions: () => WEATHER_WORDS }],
  category: "sv",
  serverSide: true,
} satisfies Omit<CommandDesc, "execute">;
