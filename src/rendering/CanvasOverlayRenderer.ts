import type { Spritesheet } from "../assets/Spritesheet.js";
import type { OverlayDraw } from "./OverlayFrame.js";

export function drawOverlayGeometry(
  ctx: CanvasRenderingContext2D,
  items: readonly OverlayDraw[],
  sheets: ReadonlyMap<string, Spritesheet>,
): void {
  for (const d of items) {
    ctx.save();
    try {
      ctx.globalAlpha = d.alpha;
      if (d.fill) ctx.fillStyle = d.fill;
      if (d.stroke) ctx.strokeStyle = d.stroke;
      ctx.lineWidth = d.lineWidth;
      switch (d.kind) {
        case "rect":
          if (d.fill) ctx.fillRect(d.x, d.y, d.width, d.height);
          if (d.stroke) ctx.strokeRect(d.x, d.y, d.width, d.height);
          break;
        case "line":
          ctx.beginPath();
          ctx.moveTo(d.x, d.y);
          ctx.lineTo(d.width, d.height);
          ctx.stroke();
          break;
        case "circle":
          ctx.beginPath();
          ctx.arc(d.x, d.y, d.width, 0, Math.PI * 2);
          ctx.fill();
          break;
        case "cross":
          ctx.beginPath();
          ctx.moveTo(d.x - d.width, d.y);
          ctx.lineTo(d.x + d.width, d.y);
          ctx.moveTo(d.x, d.y - d.width);
          ctx.lineTo(d.x, d.y + d.width);
          ctx.stroke();
          break;
        case "text":
          ctx.font = d.font;
          ctx.textAlign = d.centered ? "center" : "start";
          ctx.textBaseline = d.centered ? "bottom" : "alphabetic";
          ctx.fillText(d.text, d.x, d.y);
          break;
        case "sprite": {
          const sheet = sheets.get(d.sheetKey);
          if (sheet)
            ctx.drawImage(
              sheet.image,
              d.srcX,
              d.srcY,
              d.srcWidth,
              d.srcHeight,
              d.x,
              d.y,
              d.width,
              d.height,
            );
          break;
        }
      }
    } finally {
      ctx.restore();
    }
  }
}
