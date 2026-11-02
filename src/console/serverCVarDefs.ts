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
