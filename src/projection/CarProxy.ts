import bank from "../traffic/vehicles-v1.json" with { type: "json" };

/** Game axes: x right, y ground-depth, z height. All numbers are world pixels. */
export type Point3 = readonly [x: number, y: number, z: number];
export type Pixel = readonly [u: number, v: number];
export interface ProxyPatch {
  readonly name: string;
  readonly vertices: readonly Point3[];
  readonly textured: boolean;
}
const approved = bank.views.find((v) => v.id === "vehicle:compact-1:east");
if (!approved) throw Error("Missing pinned compact-car view");
const [sourceX, sourceY] = approved.rect;
if (sourceX === undefined || sourceY === undefined)
  throw Error("Missing pinned car source dimensions");
const collider = approved.metadata.colliders[0];
if (!collider) throw Error("Missing approved collision geometry");

export const CAR_PROXY = {
  revision: "car-projection-v1",
  name: "Blue compact car",
  sourceView: approved.id,
  sourceFingerprint: bank.sourceFingerprint,
  atlas: "assets/tilesets/me-complete.png",
  // Dimensions of the pinned original atlas, not the bank's padded per-car sheet.
  atlasSize: [2816, 8224] as const,
  // Crop only the car body; the full approved atlas rectangle stays unchanged.
  rect: [sourceX, sourceY + 24, 64, 40] as const,
  sourceOrigin: [32, 55] as Pixel,
  sourceSize: [64, 64] as const,
  cropTop: 24,
  // The approved side artwork visibly faces left, despite its source label.
  facing: "left",
  collision: { width: collider.width, depth: collider.height, height: collider.zHeight },
} as const;

/** Fixed oblique authoring projection. Viewing camera may move independently. */
export function projectSource([x, y, z]: Point3): Pixel {
  return [x + CAR_PROXY.sourceOrigin[0], CAR_PROXY.sourceOrigin[1] + y - z];
}
export function liftSource([u, v]: Pixel, depth: number): Point3 {
  return [u - CAR_PROXY.sourceOrigin[0], depth, CAR_PROXY.sourceOrigin[1] + depth - v];
}
export function sourceUV(point: Point3): Pixel {
  const [u, v] = projectSource(point);
  return [u / 64, 1 - (v - CAR_PROXY.cropTop) / 40];
}

/** Image-anchored low-poly shell. Adjacent patches share exact vertices.
 * Each top patch spans the depth of the car; side pixels include the near wheels.
 * This is a fitted visual approximation, not a replacement physics mesh.
 */
export function carProxyPatches(): ProxyPatch[] {
  const columns = [0, 14, 24, 48, 64];
  const farPixels = [37, 30, 24, 24, 38];
  const nearPixels = [55, 49, 42, 42, 57];
  const names = ["Bonnet", "Windscreen", "Roof", "Rear slope"];
  const far = columns.map((u, i) => liftSource([u, farPixels[i] ?? 24], -7));
  const near = columns.map((u, i) => liftSource([u, nearPixels[i] ?? 42], 11));
  const bottom = columns.map((u) => liftSource([u, 64], 9));
  const backBottom = columns.map((u) => [u - 32, -7, 0] as Point3);
  const patches: ProxyPatch[] = [];
  for (let i = 0; i < columns.length - 1; i++) {
    const a = far[i],
      b = far[i + 1],
      c = near[i + 1],
      d = near[i],
      e = bottom[i],
      f = bottom[i + 1],
      g = backBottom[i],
      h = backBottom[i + 1];
    if (!a || !b || !c || !d || !e || !f || !g || !h) throw Error("Invalid proxy section");
    patches.push({ name: names[i] ?? "Body", vertices: [a, b, c, d], textured: true });
    patches.push({ name: `Side ${i + 1}`, vertices: [d, c, f, e], textured: true });
    patches.push({ name: `Unseen back ${i + 1}`, vertices: [b, a, g, h], textured: false });
    patches.push({ name: `Underside ${i + 1}`, vertices: [e, f, h, g], textured: false });
  }
  for (const i of [0, 4]) {
    const a = far[i],
      b = near[i],
      c = bottom[i],
      d = backBottom[i];
    if (!a || !b || !c || !d) throw Error("Invalid proxy end");
    patches.push({
      name: i === 0 ? "Unseen front" : "Unseen rear",
      vertices: i === 0 ? [a, b, c, d] : [d, c, b, a],
      textured: false,
    });
  }
  return patches;
}
