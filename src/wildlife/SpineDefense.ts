import type { Entity } from "../entities/Entity.js";

/** Explicit game deterrence, not an inferred size/damage model. Giants and raptors retain diets. */
const deterred = new Set([
  "fox",
  "wolf",
  "coyote",
  "spotted-hyena",
  "lynx",
  "bobcat",
  "mongoose",
  "honey-badger",
  "fossa",
  "white-nosed-coati",
  "jaguar",
  "leopard",
  "tiger",
  "lion",
  "panther",
  "brown-bear",
  "polar-bear",
  "dire-wolf",
]);
export function spineDefenseBlocks(prey: Entity, hunter: Entity, species: string): boolean {
  const t = prey.animalWork,
    anchor = t?.sitePosition;
  if (
    !t?.defenseReady ||
    !anchor ||
    !deterred.has(species) ||
    Math.hypot(prey.position.wx - anchor.wx, prey.position.wy - anchor.wy) > 2 ||
    Math.abs((prey.wz ?? 0) - anchor.z) > 1 ||
    (prey.jumpZ ?? 0) > 1
  )
    return false;
  if (prey.type !== `wildlife-${t.kind}-provisional-v1`) return false;
  if (t.kind === "hedgehog") return t.state === "curled";
  if (t.kind !== "porcupine" || t.state !== "rattle") return false;
  const direction = prey.sprite?.direction,
    dx = hunter.position.wx - prey.position.wx,
    dy = hunter.position.wy - prey.position.wy,
    d = Math.hypot(dx, dy);
  const facing =
    direction === 0 ? [0, 1] : direction === 1 ? [0, -1] : direction === 2 ? [-1, 0] : [1, 0];
  return d > 0 && ((facing[0] ?? 0) * dx + (facing[1] ?? 0) * dy) / d < -0.5;
}
