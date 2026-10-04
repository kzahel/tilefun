/** Extend original edge colors through transparent texels of a derived texture.
 * Breadth-first expansion picks the nearest original painted texel (Manhattan
 * distance). Original RGBA bytes stay exact. Use only for solid top surfaces;
 * wheel/side silhouettes retain the original alpha. No source asset is mutated.
 */
export function extendOpaqueEdges(
  source: Uint8ClampedArray,
  width: number,
  height: number,
): Uint8ClampedArray {
  if (source.length !== width * height * 4) throw Error("Invalid proxy texture dimensions");
  const result = source.slice();
  const visited = new Uint8Array(width * height);
  const queue = new Uint32Array(width * height);
  let head = 0,
    tail = 0;
  for (let i = 0; i < visited.length; i++) {
    if ((source[i * 4 + 3] ?? 0) === 0) continue;
    visited[i] = 1;
    queue[tail++] = i;
  }
  while (head < tail) {
    const i = queue[head++];
    if (i === undefined) throw Error("Invalid texture queue");
    const x = i % width,
      y = Math.floor(i / width);
    for (const j of [
      x > 0 ? i - 1 : -1,
      x + 1 < width ? i + 1 : -1,
      y > 0 ? i - width : -1,
      y + 1 < height ? i + width : -1,
    ]) {
      if (j < 0 || visited[j]) continue;
      visited[j] = 1;
      result.set(result.subarray(i * 4, i * 4 + 4), j * 4);
      queue[tail++] = j;
    }
  }
  return result;
}
