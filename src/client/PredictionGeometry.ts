import type { Prop } from "../entities/Prop.js";
import type { PhysicsGeometry } from "../physics/PhysicsScene.js";
import type { World } from "../world/World.js";

/** The replica's terrain and props as the predictor's physics geometry; `propsRevision`
 * changes whenever a new world or prop list is bound. */
export function predictionGeometry(
  world: World,
  props: readonly Prop[],
  propsRevision: number,
): PhysicsGeometry {
  return {
    getCollision: (x, y) => world.getCollisionIfLoaded(x, y),
    getHeight: (x, y) => world.getHeightAt(x, y),
    queryProps: (bounds) =>
      props.filter((prop) => {
        // The common compiler clips exact wall/surface shapes. This is only a
        // conservative broad filter and includes long authored bridge sections.
        const c = prop.collider;
        if (!c || prop.walls?.length) return true;
        const x = prop.position.wx + c.offsetX,
          y = prop.position.wy + c.offsetY;
        return (
          x + c.width / 2 >= bounds.left &&
          x - c.width / 2 <= bounds.right &&
          y + c.height / 2 >= bounds.top &&
          y - c.height / 2 <= bounds.bottom
        );
      }),
    geometryVersion: (cx, cy) => {
      const chunk = world.getChunkIfLoaded(cx, cy);
      return {
        identity: chunk,
        revision: `${chunk?.revision}:${chunk?.visualRevision}:${chunk?.physicsRevision}:${propsRevision}`,
      };
    },
  };
}
