import type { PositionComponent } from "../entities/Entity.js";
import type { Prop } from "../entities/Prop.js";

/** Ordinary editable low rock; geometry, identity and ground are revalidated on use. */
export interface BrowsingRock extends PositionComponent {
  id: string;
  z: number;
  ground: number;
  width: number;
  depth: number;
}
export function browsingRocks(
  props: readonly Prop[],
  surface: (p: PositionComponent) => number,
): BrowsingRock[] {
  return props.flatMap((p) => {
    const c = p.collider;
    if (p.type !== "prop-low-rock" || !c?.walkableTop || c.zHeight === undefined) return [];
    const ground = surface(p.position),
      z = ground + (c.zBase ?? 0) + c.zHeight;
    if (z - ground <= 0 || z - ground > 12) return [];
    return [
      {
        id: p.proceduralId ?? p.persistentId ?? `${p.type}:${p.position.wx}:${p.position.wy}`,
        wx: p.position.wx + c.offsetX,
        wy: p.position.wy + c.offsetY,
        ground,
        z,
        width: c.width,
        depth: c.height,
      },
    ];
  });
}
export function sameRock(a: BrowsingRock, b: BrowsingRock): boolean {
  return (
    a.id === b.id &&
    a.wx === b.wx &&
    a.wy === b.wy &&
    a.z === b.z &&
    a.ground === b.ground &&
    a.width === b.width &&
    a.depth === b.depth
  );
}
