import { type SpriteMetadata, spriteMetadata, spriteRegion } from "./SpriteCatalog.js";

/** Any image source usable with drawImage that exposes width/height. */
export type SpriteImage = CanvasImageSource & { width: number; height: number };

export class Spritesheet {
  readonly metadata: SpriteMetadata;
  readonly cols: number;
  readonly rows: number;

  constructor(
    readonly image: SpriteImage,
    readonly tileWidth: number,
    readonly tileHeight: number,
  ) {
    this.metadata = spriteMetadata(image.width, image.height, tileWidth, tileHeight);
    this.cols = this.metadata.cols;
    this.rows = this.metadata.rows;
  }

  /** Get the source rectangle for a tile at (col, row). */
  getRegion(col: number, row: number): { x: number; y: number; width: number; height: number } {
    return spriteRegion(this.metadata, col, row);
  }

  /** Draw a tile from the spritesheet onto the given context. */
  drawTile(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    col: number,
    row: number,
    destX: number,
    destY: number,
    scale = 1,
  ): void {
    const region = this.getRegion(col, row);
    ctx.drawImage(
      this.image,
      region.x,
      region.y,
      region.width,
      region.height,
      destX,
      destY,
      region.width * scale,
      region.height * scale,
    );
  }
}
