import type { Prop, PropCollider } from "../entities/Prop.js";

export interface FierceDenSpec {
  species: string;
  type: string;
  label: string;
  width: number;
  height: number;
  collider: PropCollider | null;
  sortOffsetY: number;
}
/** Normal durable props, also available for independent editor placement. */
export const FIERCE_DENS: readonly FierceDenSpec[] = [
  {
    species: "small-dragon",
    type: "prop-dragon-hoard",
    label: "Dragon treasure hoard",
    width: 64,
    height: 32,
    collider: null,
    sortOffsetY: -8,
  },
];
export const fierceDenSpec = (type: string) => FIERCE_DENS.find((d) => d.type === type);
export const denForPredator = (type: string) =>
  FIERCE_DENS.find((d) => type === `wildlife-${d.species}-predator-v1`);
export function createFierceDen(spec: FierceDenSpec, wx: number, wy: number): Prop {
  return {
    id: 0,
    type: spec.type,
    position: { wx, wy },
    isProp: true,
    sprite: {
      sheetKey: spec.type,
      frameCol: 0,
      frameRow: 0,
      spriteWidth: spec.width,
      spriteHeight: spec.height,
    },
    collider: spec.collider ? { ...spec.collider } : null,
    walls: null,
    sortOffsetY: spec.sortOffsetY,
  };
}
