import type { ConsoleEngine } from "./ConsoleEngine.js";
import type { CVar } from "./CVar.js";

export interface ClientCVars {
  r_showbboxes: CVar<boolean>;
  r_showchunks: CVar<boolean>;
  r_showgrid: CVar<boolean>;
  r_showfps: CVar<boolean>;
  r_pixelscale: CVar<number>;
  cl_timescale: CVar<number>;
  cl_nopredict: CVar<boolean>;
}

export function registerClientCVars(engine: ConsoleEngine): ClientCVars {
  const r_showbboxes = engine.cvars.register<boolean>({
    name: "r_showbboxes",
    description: "Show collision hitboxes",
    type: "boolean",
    defaultValue: false,
    category: "r",
  });

  const r_showchunks = engine.cvars.register<boolean>({
    name: "r_showchunks",
    description: "Show chunk boundaries",
    type: "boolean",
    defaultValue: false,
    category: "r",
  });

  const r_showgrid = engine.cvars.register<boolean>({
    name: "r_showgrid",
    description: "Show tile grid overlay",
    type: "boolean",
    defaultValue: false,
    category: "r",
  });

  const r_showfps = engine.cvars.register<boolean>({
    name: "r_showfps",
    description: "Show FPS and entity count",
    type: "boolean",
    defaultValue: false,
    category: "r",
  });

  const r_pixelscale = engine.cvars.register<number>({
    name: "r_pixelscale",
    description: "Camera zoom level",
    type: "number",
    defaultValue: 1,
    min: 0.05,
    max: 3,
    category: "r",
  });

  const cl_timescale = engine.cvars.register<number>({
    name: "cl_timescale",
    description: "Client-side time scale multiplier",
    type: "number",
    defaultValue: 1,
    min: 0.1,
    max: 10,
    category: "cl",
  });

  const cl_nopredict = engine.cvars.register<boolean>({
    name: "cl_nopredict",
    description: "Disable client-side prediction",
    type: "boolean",
    defaultValue: false,
    category: "cl",
  });

  return {
    r_showbboxes,
    r_showchunks,
    r_showgrid,
    r_showfps,
    r_pixelscale,
    cl_timescale,
    cl_nopredict,
  };
}
