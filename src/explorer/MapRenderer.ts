import type { OverviewResult as RegionalResult } from "../generation/Overview.js";
import {
  type Connection,
  LandCover,
  type Point,
  REGION_SIZE,
  type Settlement,
} from "../generation/regional/RegionalPlanner.js";
import type { Overlays, ViewState } from "./ViewState.js";

export type MapFeature = Settlement | Connection;
const COLORS = [
  [64, 116, 135],
  [215, 212, 167],
  [161, 184, 133],
  [86, 128, 103],
  [193, 189, 139],
  [197, 168, 125],
];

function contextFor(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser cannot draw the map.");
  return context;
}

/** Only one visible raster is resident. No persistent atlas or generated sprites. */
export class MapRenderer {
  private readonly raster = document.createElement("canvas");
  private result: RegionalResult | null = null;
  private layers = "";

  draw(
    canvas: HTMLCanvasElement,
    width: number,
    height: number,
    view: ViewState,
    overlays: Overlays,
    result: RegionalResult | null,
    selectedId: string | null,
  ): void {
    const ctx = contextFor(canvas);
    const dpr = canvas.width / width;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#e2e4d4";
    ctx.fillRect(0, 0, width, height);
    if (!result) return;
    const layers = `${overlays.geography}:${overlays.landUse}`;
    if (this.result !== result || this.layers !== layers) {
      this.result = result;
      this.layers = layers;
      this.paintRaster(result, overlays);
    }
    const sx = (x: number) => (x - view.x) * view.zoom + width / 2;
    const sy = (y: number) => (y - view.y) * view.zoom + height / 2;
    const grid = result.grid;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(
      this.raster,
      sx(grid.x),
      sy(grid.y),
      grid.width * grid.step * view.zoom,
      grid.height * grid.step * view.zoom,
    );

    if (overlays.boundaries) {
      const step =
        REGION_SIZE * 2 ** Math.max(0, Math.ceil(Math.log2(80 / (REGION_SIZE * view.zoom))));
      const minX = view.x - width / (2 * view.zoom);
      const minY = view.y - height / (2 * view.zoom);
      ctx.strokeStyle = "#263c4260";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      for (let x = Math.ceil(minX / step) * step; sx(x) < width; x += step) {
        ctx.moveTo(sx(x), 0);
        ctx.lineTo(sx(x), height);
      }
      for (let y = Math.ceil(minY / step) * step; sy(y) < height; y += step) {
        ctx.moveTo(0, sy(y));
        ctx.lineTo(width, sy(y));
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (overlays.roads) {
      for (const road of result.connections) {
        ctx.beginPath();
        road.points.forEach((p, i) => {
          if (i) ctx.lineTo(sx(p.x), sy(p.y));
          else ctx.moveTo(sx(p.x), sy(p.y));
        });
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.strokeStyle = selectedId === road.id ? "#8d472f" : "#546b5466";
        ctx.lineWidth = Math.max(3.5, road.width * view.zoom + 2);
        ctx.stroke();
        ctx.strokeStyle = "#fcf4dc";
        ctx.lineWidth = Math.max(2, road.width * view.zoom - 1);
        ctx.stroke();
      }
    }
    if (overlays.settlements) {
      for (const settlement of result.settlements) {
        ctx.beginPath();
        settlement.outline.forEach((p, i) => {
          if (i) ctx.lineTo(sx(p.x), sy(p.y));
          else ctx.moveTo(sx(p.x), sy(p.y));
        });
        ctx.closePath();
        ctx.fillStyle = settlement.kind === "city" ? "#d5aa7677" : "#eee1b577";
        ctx.fill();
        ctx.strokeStyle =
          selectedId === settlement.id
            ? "#883e27"
            : settlement.kind === "city"
              ? "#95653d"
              : "#7e8159";
        ctx.lineWidth = selectedId === settlement.id ? 3 : 1.5;
        ctx.stroke();
        const x = sx(settlement.center.x);
        const y = sy(settlement.center.y);
        ctx.fillStyle = "#fcf7e8";
        ctx.beginPath();
        ctx.arc(x, y, settlement.kind === "city" ? 5 : 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#795538";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      const placed: { x: number; y: number; width: number }[] = [];
      for (const settlement of [...result.settlements].sort(
        (a, b) => Number(b.kind === "city") - Number(a.kind === "city") || a.id.localeCompare(b.id),
      )) {
        const x = sx(settlement.center.x);
        const y = sy(settlement.bounds.minY) - 13;
        if (x < -80 || x > width + 80 || y < -20 || y > height + 20) continue;
        ctx.font = `${settlement.kind === "city" ? "600 13" : "500 12"}px system-ui`;
        const labelWidth = ctx.measureText(settlement.name).width + 18;
        if (
          placed.some(
            (p) => Math.abs(p.y - y) < 27 && Math.abs(p.x - x) < (p.width + labelWidth) / 2 + 8,
          )
        )
          continue;
        placed.push({ x, y, width: labelWidth });
        ctx.fillStyle = "#fcf8eced";
        ctx.beginPath();
        ctx.roundRect(x - labelWidth / 2, y - 12, labelWidth, 24, 5);
        ctx.fill();
        ctx.fillStyle = "#34483c";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(settlement.name, x, y);
      }
    }
  }

  private paintRaster(result: RegionalResult, overlays: Overlays): void {
    this.raster.width = result.grid.width;
    this.raster.height = result.grid.height;
    const context = contextFor(this.raster);
    const pixels = context.createImageData(this.raster.width, this.raster.height);
    for (let i = 0; i < result.cover.length; i++) {
      const cover = result.cover[i] ?? 0;
      const elevation = result.elevation[i] ?? 0;
      let color = COLORS[cover] ?? COLORS[2] ?? [161, 184, 133];
      if (!overlays.landUse && cover > LandCover.Shore) color = [170, 186, 148];
      if (!overlays.geography && cover <= LandCover.Shore) color = [226, 228, 212];
      if (!overlays.geography && !overlays.landUse) color = [226, 228, 212];
      const shade = overlays.geography
        ? cover === LandCover.Water
          ? Math.max(-12, Math.min(15, (elevation + 0.15) * 70))
          : Math.min(16, elevation * 25)
        : 0;
      const offset = i * 4;
      pixels.data[offset] = (color[0] ?? 0) + shade;
      pixels.data[offset + 1] = (color[1] ?? 0) + shade;
      pixels.data[offset + 2] = (color[2] ?? 0) + shade;
      pixels.data[offset + 3] = 255;
    }
    context.putImageData(pixels, 0, 0);
  }

  release(): void {
    this.result = null;
    this.raster.width = this.raster.height = 0;
  }
}

export function featureAt(
  result: RegionalResult,
  point: Point,
  zoom: number,
  overlays: Overlays,
): MapFeature | null {
  if (overlays.settlements) {
    const settlement = result.settlements.find(
      (s) =>
        point.x >= s.bounds.minX &&
        point.x < s.bounds.maxX &&
        point.y >= s.bounds.minY &&
        point.y < s.bounds.maxY,
    );
    if (settlement) return settlement;
  }
  if (overlays.roads) {
    for (const road of result.connections) {
      const tolerance = Math.max(road.width / 2, 8 / zoom);
      for (let i = 1; i < road.points.length; i++) {
        const a = road.points[i - 1];
        const b = road.points[i];
        if (!a || !b) continue;
        const x = Math.max(Math.min(a.x, b.x), Math.min(Math.max(a.x, b.x), point.x));
        const y = Math.max(Math.min(a.y, b.y), Math.min(Math.max(a.y, b.y), point.y));
        if (Math.hypot(point.x - x, point.y - y) <= tolerance) return road;
      }
    }
  }
  return null;
}
