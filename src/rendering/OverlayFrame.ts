/** Screen-space editor geometry. Styles are explicit values, never Canvas state. */
export interface OverlayDraw {
  kind: "rect" | "line" | "circle" | "cross" | "text" | "sprite";
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  stroke: string;
  lineWidth: number;
  text: string;
  font: string;
  centered: boolean;
  sheetKey: string;
  srcX: number;
  srcY: number;
  srcWidth: number;
  srcHeight: number;
  alpha: number;
}

/** Reuse warm overlay records without retaining unbounded editor view history. */
export class OverlayFrame {
  readonly items: OverlayDraw[] = [];
  private readonly pool: OverlayDraw[] = [];
  private underused = 0;

  begin(): void {
    this.release();
  }
  next(kind: OverlayDraw["kind"]): OverlayDraw {
    const index = this.items.length;
    let item = this.pool[index];
    if (!item) {
      item = {
        kind,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        fill: "",
        stroke: "",
        lineWidth: 1,
        text: "",
        font: "",
        centered: false,
        sheetKey: "",
        srcX: 0,
        srcY: 0,
        srcWidth: 0,
        srcHeight: 0,
        alpha: 1,
      };
      if (index < 2048) this.pool.push(item);
    }
    item.kind = kind;
    item.fill = "";
    item.stroke = "";
    item.lineWidth = 1;
    item.alpha = 1;
    item.text = "";
    item.sheetKey = "";
    this.items.push(item);
    return item;
  }
  rect(
    x: number,
    y: number,
    width: number,
    height: number,
    fill: string,
    stroke = "",
    lineWidth = 1,
  ): void {
    const d = this.next("rect");
    d.x = x;
    d.y = y;
    d.width = width;
    d.height = height;
    d.fill = fill;
    d.stroke = stroke;
    d.lineWidth = lineWidth;
  }
  line(x: number, y: number, x2: number, y2: number, stroke: string): void {
    const d = this.next("line");
    d.x = x;
    d.y = y;
    d.width = x2;
    d.height = y2;
    d.stroke = stroke;
  }
  label(text: string, x: number, y: number, fill: string, font: string, centered = false): void {
    const d = this.next("text");
    d.text = text;
    d.x = x;
    d.y = y;
    d.fill = fill;
    d.font = font;
    d.centered = centered;
  }
  release(): void {
    const used = this.items.length;
    for (const d of this.items) {
      d.text = "";
      d.sheetKey = "";
    }
    this.items.length = 0;
    this.underused = this.pool.length > Math.max(64, used * 2) ? this.underused + 1 : 0;
    if (this.underused >= 60) {
      this.pool.length = Math.max(64, used);
      this.underused = 0;
    }
  }
  clear(): void {
    this.release();
    this.pool.length = 0;
    this.underused = 0;
  }
}
