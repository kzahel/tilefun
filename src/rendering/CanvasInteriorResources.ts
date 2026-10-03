import { reviewContext2D } from "../art/reviewCanvas.js";
import type { Spritesheet } from "../assets/Spritesheet.js";
import { PIXEL_SCALE } from "../config/constants.js";
import type { InteriorContent, InteriorDraw } from "../interiors/InteriorPresentation.js";
import type { InteriorLayer } from "../interiors/LayeredInteriorMap.js";
import { Camera } from "./Camera.js";
import { type CanvasTerrainSource, drawSceneEntry2D } from "./Canvas2DRenderer.js";
import { drawLayeredInteriorMap } from "./CanvasInteriorMap.js";

/** One backend's bounded room cache. Ordering is supplied by presentation data. */
export class CanvasInteriorResources {
  readonly contentId: number;
  private readonly layers: { floor: HTMLCanvasElement; walls: HTMLCanvasElement };
  private readonly bands = new Map<number, HTMLCanvasElement>();
  private readonly nativeCamera = new Camera();

  constructor(
    private readonly atlas: CanvasImageSource,
    content: InteriorContent,
    review = false,
  ) {
    this.contentId = content.id;
    this.nativeCamera.zoom = 1 / PIXEL_SCALE;
    const { map, editable } = content;
    const context = (canvas: HTMLCanvasElement) => {
      const ctx = review ? reviewContext2D(canvas) : canvas.getContext("2d");
      if (!ctx) throw Error("Missing interior layer canvas");
      return ctx;
    };
    const raster = (layers: readonly InteriorLayer[]) => {
      const canvas = document.createElement("canvas");
      canvas.width = map.width * 16;
      canvas.height = Math.max(map.pixelHeight, map.height * 16 + (map.contentOffsetY ?? 0));
      drawLayeredInteriorMap(context(canvas), atlas, map, layers);
      return canvas;
    };
    this.layers = { floor: raster(["floor"]), walls: raster(["wall", "foreground", "objects"]) };
    if (editable) {
      context(this.layers.walls).clearRect(0, 0, this.layers.walls.width, this.layers.walls.height);
      for (let y = 0; y < map.height; y += 2) {
        const rows = map.cells.slice(y, y + 2);
        if (
          !rows.some((r) => r.some((c) => c.wall.length || c.foreground.length || c.objects.length))
        )
          continue;
        const canvas = document.createElement("canvas");
        canvas.width = map.width * 16;
        canvas.height = 64;
        const ctx = context(canvas);
        ctx.translate(0, 16);
        drawLayeredInteriorMap(
          ctx,
          atlas,
          { ...map, height: rows.length, pixelHeight: 32, cells: rows },
          ["wall", "foreground", "objects"],
        );
        this.bands.set(y, canvas);
      }
    }
  }

  draw(
    ctx: CanvasRenderingContext2D,
    draws: readonly InteriorDraw[],
    sheets: Map<string, Spritesheet>,
    terrain?: CanvasTerrainSource,
  ): void {
    ctx.save();
    try {
      ctx.imageSmoothingEnabled = false;
      for (const draw of draws)
        switch (draw.kind) {
          case "layer":
            ctx.drawImage(this.layers[draw.layer], 0, 0);
            break;
          case "wall-band": {
            const image = this.bands.get(draw.row);
            if (image) ctx.drawImage(image, 0, draw.y);
            break;
          }
          case "furniture":
            ctx.drawImage(this.atlas, ...draw.src, draw.x, draw.y, draw.width, draw.height);
            break;
          case "scene":
            if (draw.item) {
              ctx.save();
              try {
                ctx.translate(0, draw.offsetY);
                drawSceneEntry2D(
                  ctx,
                  this.nativeCamera,
                  draw.item,
                  sheets,
                  undefined,
                  false,
                  terrain,
                  draw.shadow,
                );
              } finally {
                ctx.restore();
              }
            }
            break;
        }
    } finally {
      ctx.restore();
    }
  }
}
