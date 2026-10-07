import type { Prop, PropCollider } from "../entities/Prop.js";
import type { FacadePiece } from "../generation/regional/BuildingRecipes.js";

/** Native F01–F09. Source-only staggered interiors were accepted on 2026-10-04;
 * seeded boundaries and solid gameplay footprints remain a separate preview. */
export const FOREST_KITS = [
  { id: 1, y: 1600, period: 128, height: 112, rightX: 2656, rightHeight: 96 },
  { id: 2, y: 1712, period: 128, height: 80, rightX: 2656, rightHeight: 80 },
  { id: 3, y: 1792, period: 112, height: 80, rightX: 2640, rightHeight: 80 },
] as const;
export const FOREST_ROW_STEP = 48;
export const forestRowType = (kit: number, repeats: number) =>
  `pattern:forest-thicket-v1:${kit}:${repeats}`;
export function forestRowDefinition(type: string) {
  const m = /^pattern:forest-thicket-v1:([1-3]):([1-9])$/.exec(type);
  const kit = FOREST_KITS[Number(m?.[1]) - 1];
  return kit ? { kit, repeats: Number(m?.[2]) } : undefined;
}
export function forestRowWalls(type: string): PropCollider[] | undefined {
  const spec = forestRowDefinition(type);
  if (!spec) return;
  const width = spec.repeats * spec.kit.period;
  // The crowded center occupies a continuous ground band. Narrower cap footprints
  // let the player approach the visible tapered sides; crowns are not invisible walls.
  return [
    { offsetX: 8, offsetY: 0, width, height: 48, zHeight: 80 },
    { offsetX: -width / 2, offsetY: -8, width: 16, height: 32, zHeight: 80 },
    {
      offsetX: width / 2 + 16,
      offsetY: spec.kit.id === 1 ? -16 : -8,
      width: 16,
      height: spec.kit.id === 1 ? 16 : 32,
      zHeight: 80,
    },
  ];
}
export function forestRowProp(type: string, wx: number, wy: number): Prop | undefined {
  const spec = forestRowDefinition(type);
  if (!spec) return;
  const { kit, repeats } = spec;
  const width = 48 + repeats * kit.period + 32;
  const piece = (sx: number, w: number, h: number, x: number): FacadePiece => ({
    frameCol: sx / 16,
    frameRow: kit.y / 16,
    spriteWidth: w,
    spriteHeight: h,
    dx: x + w / 2 - width / 2,
    // Preserve the source kit's top alignment, including the shorter F03 cap.
    dy: h - kit.height,
  });
  return {
    id: 0,
    type,
    position: { wx, wy },
    isProp: true,
    sprite: {
      sheetKey: "me-complete",
      frameCol: 153,
      frameRow: kit.y / 16,
      spriteWidth: width,
      spriteHeight: kit.height,
      parts: [
        piece(2448, 48, kit.height, 0),
        ...Array.from({ length: repeats }, (_, i) =>
          piece(2512, kit.period, kit.height, 48 + i * kit.period),
        ),
        piece(kit.rightX, 32, kit.rightHeight, 48 + repeats * kit.period),
      ],
    },
    collider: null,
    walls: forestRowWalls(type) ?? null,
  };
}
