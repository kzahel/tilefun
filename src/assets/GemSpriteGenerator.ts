/**
 * Procedurally generate a 4-frame sparkle gem sprite (64×16 canvas).
 * Each 16×16 frame shows a gold diamond with a shifting white highlight.
 */
export function generateGemSprite(): HTMLCanvasElement {
  const SIZE = 16;
  const FRAMES = 4;
  const canvas = document.createElement("canvas");
  canvas.width = SIZE * FRAMES;
  canvas.height = SIZE;
  // biome-ignore lint/style/noNonNullAssertion: canvas always supports 2d
  const ctx = canvas.getContext("2d")!;

  // Diamond vertices (centered in 16×16 cell, slight vertical bias)
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const hw = 5; // half-width
  const hh = 6; // half-height

  for (let f = 0; f < FRAMES; f++) {
    const ox = f * SIZE;
    ctx.save();
    ctx.translate(ox, 0);

    // Outer diamond — dark gold outline
    drawDiamond(ctx, cx, cy, hw + 1, hh + 1, "#B8860B");
    // Inner diamond — gold fill
    drawDiamond(ctx, cx, cy, hw, hh, "#FFD700");
    // Highlight — lighter gold, offset slightly up
    drawDiamond(ctx, cx, cy - 1, hw - 2, hh - 2, "#FFE766");

    // Sparkle highlight — white dot that moves each frame
    const sparkleOffsets: [number, number][] = [
      [-2, -3],
      [2, -1],
      [1, 2],
      [-1, 0],
    ];
    const [sx, sy] = sparkleOffsets[f % FRAMES] as [number, number];
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(cx + sx, cy + sy, 2, 2);
    // Secondary smaller sparkle
    const [sx2, sy2] = sparkleOffsets[(f + 2) % FRAMES] as [number, number];
    ctx.fillRect(cx + sx2 + 1, cy + sy2 + 1, 1, 1);

    ctx.restore();
  }

  return canvas;
}

function drawDiamond(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  hw: number,
  hh: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx, cy - hh);
  ctx.lineTo(cx + hw, cy);
  ctx.lineTo(cx, cy + hh);
  ctx.lineTo(cx - hw, cy);
  ctx.closePath();
  ctx.fill();
}
