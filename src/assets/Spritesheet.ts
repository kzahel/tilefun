/** Any image source usable with drawImage that exposes width/height. */
export type SpriteImage = CanvasImageSource & { width: number; height: number };

export class Spritesheet {
  readonly cols: number;
  readonly rows: number;

  constructor(
    readonly image: SpriteImage,
    readonly tileWidth: number,
    readonly tileHeight: number,
  ) {
    this.cols = Math.floor(image.width / tileWidth);
    this.rows = Math.floor(image.height / tileHeight);
  }

  /** Get the source rectangle for a tile at (col, row). */
  getRegion(col: number, row: number): { x: number; y: number; width: number; height: number } {
    return {
      x: col * this.tileWidth,
      y: row * this.tileHeight,
      width: this.tileWidth,
      height: this.tileHeight,
    };
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
