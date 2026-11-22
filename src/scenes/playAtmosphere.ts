import type { Entity } from "../entities/Entity.js";
import { type Atmosphere, atmosphereOf, type ViewLight } from "../sky/Atmosphere.js";
import { type SkyClockView, skyAt } from "../sky/Sky.js";

/** Lanterns one view lights (`MAX_VIEW_LIGHTS`). */
const LANTERNS = 4;
/** A lantern's reach in world pixels, and the least it reaches on screen. */
const LANTERN_REACH = 84;
const LANTERN_MIN_PIXELS = 96;
/** The lantern is held at about chest height above a body's feet. */
const LANTERN_HEIGHT = 10;

export interface AtmosphereView {
  /** The presented bodies: players carry lanterns. */
  readonly entities: readonly Entity[];
  readonly eye: { readonly x: number; readonly y: number };
  /** The top-down camera's scale; first person has none. */
  readonly scale: number | undefined;
  readonly region: { readonly width: number; readonly height: number };
  readonly indoors: boolean;
  readonly headset: boolean;
  /** Presentation seconds, which the rain falls by. */
  readonly seconds: number;
}

/**
 * The sky over one view of play. Top-down, each player in sight carries a
 * lantern; in first person the viewer's own lights the middle of the view.
 * A headset has neither lanterns nor rain: both are placed on a flat screen.
 */
export function playAtmosphere(clock: SkyClockView, view: AtmosphereView): Atmosphere {
  const atmosphere = atmosphereOf(
    skyAt(clock.seed, clock.time, clock.held),
    view.indoors,
    !view.headset,
  );
  const lights = atmosphere.glow > 0 && !view.headset ? lanterns(view) : undefined;
  return { ...atmosphere, lights, seconds: view.seconds };
}

function lanterns({ entities, eye, scale, region }: AtmosphereView): ViewLight[] {
  const { width, height } = region;
  if (!scale) return [{ x: width / 2, y: height * 0.62, radius: Math.max(width, height) * 0.42 }];
  const radius = Math.max(LANTERN_MIN_PIXELS, LANTERN_REACH * scale);
  const lights: ViewLight[] = [];
  for (const entity of entities) {
    if (entity.type !== "player") continue;
    const { wx, wy } = entity.position;
    const x = width / 2 + (wx - eye.x) * scale;
    const y = height / 2 + (wy - (entity.wz ?? 0) - LANTERN_HEIGHT - eye.y) * scale;
    if (x < -radius || y < -radius || x > width + radius || y > height + radius) continue;
    lights.push({ x, y, radius });
    if (lights.length === LANTERNS) break;
  }
  return lights;
}
