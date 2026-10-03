import type { OutdoorAsset, OutdoorMetadata } from "../outdoor/OutdoorCatalog.js";

/** Deterministic source/ground/height diagram shared by manifest and review UI. */
export function drawVehicleDiagram(
  canvas: HTMLCanvasElement,
  image: CanvasImageSource,
  asset: OutdoorAsset,
  metadata: OutdoorMetadata,
) {
  const w = asset.rect[2],
    h = asset.rect[3];
  canvas.width = 640;
  canvas.height = 420;
  // Use the same CPU raster path for the manifest, fresh verification canvases
  // and visible review. GPU antialiasing otherwise changes the fingerprint in
  // normal Chromium, even though the source art and geometry are unchanged.
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#edf1e9";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const xs = [-metadata.anchor[0], w - metadata.anchor[0], -48, 48];
  const ys = [-metadata.anchor[1], h - metadata.anchor[1], 0, metadata.depthOffset];
  for (const c of metadata.colliders ?? []) {
    xs.push(c.offsetX - c.width / 2, c.offsetX + c.width / 2);
    ys.push(c.offsetY, c.offsetY - c.height - (c.zHeight ?? 0));
  }
  const minX = Math.min(...xs),
    maxX = Math.max(...xs),
    minY = Math.min(...ys),
    maxY = Math.max(...ys);
  const scale = Math.min(2, 560 / Math.max(1, maxX - minX), 340 / Math.max(1, maxY - minY));
  const ax = 320 - ((minX + maxX) * scale) / 2,
    ay = 210 - ((minY + maxY) * scale) / 2;
  ctx.strokeStyle = "#d1dbce";
  ctx.lineWidth = 1;
  // Invalid in-progress numeric edits must never cause an unbounded grid loop.
  const grid = 16 * scale;
  for (let x = grid >= 2 ? ax % grid : 640; x < 640; x += grid) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 420);
    ctx.stroke();
  }
  for (let y = grid >= 2 ? ay % grid : 420; y < 420; y += grid) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(640, y);
    ctx.stroke();
  }
  ctx.drawImage(
    image,
    ...asset.rect,
    ax - metadata.anchor[0] * scale,
    ay - metadata.anchor[1] * scale,
    w * scale,
    h * scale,
  );
  const box = (x: number, y: number, width: number, height: number, color: string) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(ax + x * scale, ay + y * scale, width * scale, height * scale);
  };
  box(-metadata.anchor[0], -metadata.anchor[1], w, h, "#387aaa");
  if (metadata.footprint) box(...metadata.footprint, "#16805a");
  for (const c of metadata.colliders ?? []) {
    box(c.offsetX - c.width / 2, c.offsetY - c.height, c.width, c.height, "#c73b35");
    const z = c.zHeight ?? 0;
    ctx.setLineDash([5, 4]);
    box(c.offsetX - c.width / 2, c.offsetY - c.height - z, c.width, c.height, "#b54c91");
    ctx.setLineDash([]);
    ctx.strokeStyle = "#b54c91";
    for (const x of [c.offsetX - c.width / 2, c.offsetX + c.width / 2]) {
      ctx.beginPath();
      ctx.moveTo(ax + x * scale, ay + c.offsetY * scale);
      ctx.lineTo(ax + x * scale, ay + (c.offsetY - z) * scale);
      ctx.stroke();
    }
  }
  ctx.strokeStyle = "#8b4fa6";
  ctx.beginPath();
  ctx.moveTo(ax - 90, ay + metadata.depthOffset * scale);
  ctx.lineTo(ax + 90, ay + metadata.depthOffset * scale);
  ctx.stroke();
  ctx.fillStyle = "#e2a200";
  ctx.fillRect(ax - 4, ay - 4, 8, 8);
}
