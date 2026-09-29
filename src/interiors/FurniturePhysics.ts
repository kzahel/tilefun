/** Provisional runtime shapes for the movement-review scenes, independent of static approvals. */
export interface FurnitureBody {
  height: number;
  walkableTop: boolean;
}
export type FurnitureBodies = Record<string, FurnitureBody>;
export const FURNITURE_PHYSICS_VERSION = 1;
export const FURNITURE_BODIES: FurnitureBodies = {
  "bunk-bed": { height: 24, walkableTop: true },
  wardrobe: { height: 32, walkableTop: true },
  worktable: { height: 10, walkableTop: true },
  stool: { height: 10, walkableTop: true },
  "single-bed": { height: 8, walkableTop: true },
  "side-table": { height: 10, walkableTop: true },
  dresser: { height: 12, walkableTop: true },
  "potted-tree": { height: 32, walkableTop: false },
  "floor-lamp": { height: 32, walkableTop: false },
  fireplace: { height: 26, walkableTop: false },
  "log-rack": { height: 14, walkableTop: true },
};
export function parseFurnitureBodies(value: unknown): FurnitureBodies {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid furniture heights");
  const entries = Object.entries(value);
  if (entries.length > 100) throw new Error("Too many furniture heights");
  return Object.fromEntries(
    entries.map(([id, body]) => {
      if (
        !/^[a-z0-9-]{1,80}$/.test(id) ||
        !body ||
        !Number.isInteger(body.height) ||
        body.height < 1 ||
        body.height > 64 ||
        typeof body.walkableTop !== "boolean"
      )
        throw new Error("Invalid furniture height");
      return [id, { height: body.height, walkableTop: body.walkableTop }];
    }),
  );
}
