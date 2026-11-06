export interface BedVertex {
  x: number;
  y: number;
  z: number;
}
export const BED_FACES = [
  [0, 3, 2, 1],
  [4, 5, 6, 7],
  [0, 1, 5, 4],
  [1, 2, 6, 5],
  [2, 3, 7, 6],
  [3, 0, 4, 7],
];
function sub(a: BedVertex, b: BedVertex): BedVertex {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}
function cross(a: BedVertex, b: BedVertex): BedVertex {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}
function dot(a: BedVertex, b: BedVertex) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}
function vertex(vertices: readonly BedVertex[], index: number): BedVertex {
  const value = vertices[index];
  if (!value) throw Error("Invalid bed convex geometry");
  return value;
}
function normal(vertices: readonly BedVertex[], face: number[]) {
  const a = vertex(vertices, face[0] ?? 0),
    b = vertex(vertices, face[1] ?? 0),
    c = vertex(vertices, face[2] ?? 0);
  return cross(sub(b, a), sub(c, a));
}
export function solidOccludes(vertices: readonly BedVertex[], point: BedVertex) {
  let enter = 0.0001,
    leave = Infinity;
  const center = vertices.reduce(
    (c, v) => ({ x: c.x + v.x / 8, y: c.y + v.y / 8, z: c.z + v.z / 8 }),
    { x: 0, y: 0, z: 0 },
  );
  for (const face of BED_FACES) {
    const n = normal(vertices, face),
      a = vertex(vertices, face[0] ?? 0);
    const sign = dot(n, sub(center, a)) > 0 ? -1 : 1;
    const value = dot(n, sub(point, a)) * sign,
      rate = (n.y + n.z) * sign;
    if (Math.abs(rate) < 1e-9) {
      if (value > 0) return false;
    } else if (rate > 0) leave = Math.min(leave, -value / rate);
    else enter = Math.max(enter, -value / rate);
  }
  return leave > enter;
}
