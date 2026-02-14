/** Quake-style in-game chat overlay. Messages appear at the top-left and fade out. */

interface ChatLine {
  text: string;
  age: number;
}

const MESSAGE_DURATION = 5; // seconds before fade starts
const FADE_DURATION = 1; // seconds to fade out
const MAX_LINES = 6;
const LINE_HEIGHT = 20;
const PADDING = 12;
const FONT = "bold 14px monospace";

export class ChatHUD {
  private lines: ChatLine[] = [];

  addMessage(text: string): void {
    this.lines.push({ text, age: 0 });
    if (this.lines.length > MAX_LINES) {
      this.lines.shift();
    }
  }

  update(dt: number): void {
    for (let i = this.lines.length - 1; i >= 0; i--) {
      const line = this.lines[i];
      if (!line) continue;
      line.age += dt;
      if (line.age >= MESSAGE_DURATION + FADE_DURATION) {
        this.lines.splice(i, 1);
      }
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (this.lines.length === 0) return;

    ctx.save();
    ctx.font = FONT;
    ctx.textBaseline = "top";

    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i];
      if (!line) continue;
      const y = PADDING + i * LINE_HEIGHT;

      let alpha = 1;
      if (line.age > MESSAGE_DURATION) {
        alpha = 1 - (line.age - MESSAGE_DURATION) / FADE_DURATION;
      }

      // Shadow for readability
      ctx.strokeStyle = `rgba(0, 0, 0, ${alpha})`;
      ctx.lineWidth = 3;
      ctx.strokeText(line.text, PADDING, y);

      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.fillText(line.text, PADDING, y);
    }

    ctx.restore();
  }
}
