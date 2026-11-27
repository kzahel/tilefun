/** Exposed edges of an alpha-cut shop or hotel sign. Merge straight runs so
 * raised lettering reads edge-on without one cube per pixel. */
interface Edge {
  x: number;
  y: number;
  dx: number;
  dy: number;
  u: number;
  v: number;
}
const cache = new WeakMap<HTMLCanvasElement, Edge[]>();
type Solid = (x: number, y: number) => boolean;

function scan(
  length: number,
  exposed: (i: number) => boolean,
  emit: (start: number, length: number) => void,
) {
  let start = 0;
  for (let i = 0; i <= length; i++) {
    if (i < length && exposed(i)) continue;
    if (i > start) emit(start, i - start);
    start = i + 1;
  }
}
function outline(w: number, h: number, solid: Solid) {
  const edges: Edge[] = [];
  for (const side of [-1, 1]) {
    const step = side > 0 ? 1 : 0;
    for (let x = 0; x < w; x++)
      scan(
        h,
        (y) => solid(x, y) && !solid(x + side, y),
        (y, dy) => edges.push({ x: x + step, y, dx: 0, dy, u: x + 0.5, v: y }),
      );
    for (let y = 0; y < h; y++)
      scan(
        w,
        (x) => solid(x, y) && !solid(x, y + side),
        (x, dx) => edges.push({ x, y: y + step, dx, dy: 0, u: x, v: y + 0.5 }),
      );
  }
  return edges;
}

export function signEdges(image: HTMLCanvasElement): readonly Edge[] {
  const cached = cache.get(image);
  if (cached) return cached;
  const { width: w, height: h } = image;
  const data = image.getContext("2d")?.getImageData(0, 0, w, h).data;
  if (!data) return [];
  const edges = outline(
    w,
    h,
    (x, y) => x >= 0 && x < w && y >= 0 && y < h && (data[(y * w + x) * 4 + 3] ?? 0) >= 128,
  );
  cache.set(image, edges);
  return edges;
}
