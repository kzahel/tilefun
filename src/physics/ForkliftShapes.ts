import RAPIER from "@dimforge/rapier3d-compat";
import {
  CONSTRUCTION_CARGO,
  type CONSTRUCTION_CRATE,
  type CONSTRUCTION_PALLET,
} from "../entities/ConstructionCargo.js";
import { FORKLIFT, forkliftRig } from "../traffic/Forklift.js";
import { PHYSICS_PIXELS_PER_METRE as SCALE } from "./PhysicsDefaults.js";

const identity = { x: 0, y: 0, z: 0, w: 1 };

export function forkliftShapes(
  pose: number,
  halfY: number,
  halfWidth: number,
  clearance: number,
  whole: boolean,
  underside = false,
) {
  const { lift, tilt, extension } = forkliftRig(pose);
  const { mastX, mastZ, deck, tines } = FORKLIFT;
  const shapes: RAPIER.Shape[] = [];
  const translations: RAPIER.Vector[] = [];
  const rotations: RAPIER.Rotation[] = [];
  if (whole) {
    const rear = -24.4;
    const front = 15.4;
    shapes.push(
      new RAPIER.RoundCuboid(
        (front - rear) / 2 / SCALE - 1 / SCALE,
        halfY - clearance / 2 - 1 / SCALE,
        halfWidth - 1 / SCALE,
        1 / SCALE,
      ),
    );
    translations.push({ x: (front + rear) / 2 / SCALE, y: 0, z: 0 });
    rotations.push(identity);
  }
  const c = Math.cos(tilt);
  const s = Math.sin(tilt);
  const rotation = { x: 0, y: 0, z: Math.sin(tilt / 2), w: Math.cos(tilt / 2) };
  const box = (
    left: number,
    right: number,
    low: number,
    high: number,
    centerY: number,
    wide: number,
  ) => {
    const dx = (left + right) / 2 - mastX;
    const dz = (low + high) / 2 - mastZ;
    shapes.push(
      new RAPIER.Cuboid((right - left) / 2 / SCALE, (high - low) / 2 / SCALE, wide / SCALE),
    );
    translations.push({
      x: (mastX + dx * c - dz * s) / SCALE,
      y: (mastZ + dx * s + dz * c) / SCALE - halfY - clearance / 2,
      z: centerY / SCALE,
    });
    rotations.push(rotation);
  };
  if (!underside) {
    box(mastX - 1.1, mastX + 1.1, mastZ, 37 + extension, 0, 7.3);
    box(deck.back - 1.5, deck.back + 0.75, 3.5 + lift, 8.7 + lift, 0, 7.6);
  }
  const top = underside ? deck.bottom + 0.1 : deck.top;
  for (const side of [-1, 1])
    box(deck.back, deck.tip, deck.bottom + lift, top + lift, tines.y * side, tines.halfWidth);
  return new RAPIER.Compound(shapes, translations, rotations);
}

/** The three runners leave two real channels under the deck. Cargo shares
 * the same unblocked channels at its own authored proportions. */
export function woodenCargoShape(type: typeof CONSTRUCTION_PALLET | typeof CONSTRUCTION_CRATE) {
  const { width, height, physicalHeight } = CONSTRUCTION_CARGO[type].collider;
  const x = width / 2 / SCALE;
  const h = physicalHeight / SCALE;
  const runnerH = (1.8 * physicalHeight) / 12 / SCALE;
  const lateralScale = height / 17 / SCALE;
  const deck = new RAPIER.Cuboid(x, (h - runnerH) / 2, height / 2 / SCALE);
  const runner = new RAPIER.Cuboid(x, runnerH / 2, 1.55 * lateralScale);
  return new RAPIER.Compound(
    [deck, runner, runner, runner],
    [
      { x: 0, y: runnerH / 2, z: 0 },
      ...[-6.6, 0, 6.6].map((y) => ({ x: 0, y: (runnerH - h) / 2, z: y * lateralScale })),
    ],
    [identity, identity, identity, identity],
  );
}
