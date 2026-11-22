import type { Rgb, SkyState } from "./Sky.js";

/** A light in a view: its centre and reach in view pixels from the top left. */
export interface ViewLight {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
}

/** What the sky does to one drawn view of the world. */
export interface Atmosphere {
  /** What the drawn view is multiplied by; white leaves it as drawn. */
  readonly tint: Rgb;
  /** Rainfall, 0–1. */
  readonly rain: number;
  /** Lightning, 0–1. */
  readonly flash: number;
  /** How far lights undo the tint at their centres, 0–1. */
  readonly glow: number;
  /** Lanterns the players carry. */
  readonly lights?: readonly ViewLight[] | undefined;
  /** Seconds on the clock the rain falls by. */
  readonly seconds?: number | undefined;
}

/** How much of the outdoor tint and lightning reach inside a lit room. */
const INDOOR_TINT = 0.3;
const INDOOR_FLASH = 0.25;
/** A lantern's share of full light in the middle of the night. */
const NIGHT_GLOW = 0.85;

/** The sky as a view shows it. Rooms are lit and dry; nothing falls on a headset's eyes. */
export function atmosphereOf(sky: SkyState, indoors: boolean, rain = true): Atmosphere {
  if (indoors)
    return {
      tint: sky.tint.map((light) => 1 + (light - 1) * INDOOR_TINT) as unknown as Rgb,
      rain: 0,
      flash: sky.flash * INDOOR_FLASH,
      glow: 0,
    };
  return {
    tint: sky.tint,
    rain: rain ? sky.rain : 0,
    flash: sky.flash,
    glow: (1 - sky.daylight) * NIGHT_GLOW,
  };
}

/** Whether a view shows any of it: a clear day draws nothing. */
export function atmosphereShows(atmosphere: Atmosphere): boolean {
  return (
    atmosphere.rain > 0.001 || atmosphere.flash > 0.001 || atmosphere.tint.some((c) => c < 0.999)
  );
}
