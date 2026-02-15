import type { CVarDesc } from "./CVar.js";

/** Shared server CVar definitions — used by both server (for real registration) and client (for stubs). */
export const SERVER_CVAR_DEFS: readonly CVarDesc<number>[] = [
  {
    name: "sv_tickrate",
    description: "Server tick rate (Hz)",
    type: "number",
    defaultValue: 60,
    min: 1,
    max: 240,
    category: "sv",
  },
  {
    name: "sv_speed",
    description: "Player speed multiplier",
    type: "number",
    defaultValue: 1,
    min: 0.1,
    max: 20,
    category: "sv",
  },
  {
    name: "sv_gravity",
    description: "Gravity multiplier (1 = normal, 0.5 = moon, 2 = heavy)",
    type: "number",
    defaultValue: 1,
    min: 0,
    max: 20,
    category: "sv",
  },
  {
    name: "sv_timescale",
    description: "Server time scale (1 = normal, 0.5 = half speed, 2 = double)",
    type: "number",
    defaultValue: 1,
    min: 0.1,
    max: 10,
    category: "sv",
  },
];
