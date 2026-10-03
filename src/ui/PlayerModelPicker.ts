import type { Spritesheet } from "../assets/Spritesheet.js";
import { normalizePlayerModel, PLAYER_MODELS } from "../characters/PlayerModels.js";
import { ENTITY_DEFS } from "../entities/EntityDefs.js";

/** A menu-local picker; previews stop when the menu or disclosure closes. */
export class PlayerModelPicker {
  readonly element = document.createElement("details");
  onSelect: ((id: string) => Promise<void>) | null = null;
  private summary = document.createElement("summary");
  private status = document.createElement("p");
  private grid = document.createElement("div");
  private sheets = new Map<string, Spritesheet>();
  private visible = false;
  private busy = false;
  private frame = 0;
  private cards: { id: string; button: HTMLButtonElement; canvas: HTMLCanvasElement }[] = [];

  constructor() {
    this.element.dataset.testid = "player-model-picker";
    this.element.style.cssText = "width:320px;max-width:100%;margin-bottom:16px;";
    this.summary.style.cssText =
      "cursor:pointer;padding:12px;border:1px solid #8cf;border-radius:6px;font-weight:bold;";
    this.grid.style.cssText =
      "display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;max-height:40vh;overflow:auto;padding:8px 0;";
    this.grid.setAttribute("aria-label", "Player models");
    this.status.setAttribute("role", "status");
    this.status.style.cssText = "font-size:12px;margin:4px 0;";
    this.element.append(this.summary, this.grid, this.status);
    for (const model of PLAYER_MODELS) {
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("aria-label", model.name);
      button.style.cssText =
        "font:12px monospace;color:white;background:#26364b;border:2px solid #526477;border-radius:6px;min-height:108px;cursor:pointer;padding:4px;";
      const canvas = document.createElement("canvas");
      canvas.width = 64;
      canvas.height = 64;
      canvas.style.cssText = "display:block;margin:auto;image-rendering:pixelated;";
      canvas.setAttribute("aria-hidden", "true");
      const label = document.createElement("span");
      label.textContent = model.name;
      button.append(canvas, label);
      button.addEventListener("click", () => {
        void this.choose(model.id);
      });
      this.cards.push({ id: model.id, button, canvas });
      this.grid.append(button);
    }
    this.element.addEventListener("toggle", () => this.schedule());
    this.setSelected("player");
  }
  setAssets(sheets: Map<string, Spritesheet>, selected: unknown): void {
    this.sheets = sheets;
    this.setSelected(normalizePlayerModel(selected));
    this.draw(0);
  }
  setVisible(visible: boolean): void {
    this.visible = visible;
    this.schedule();
  }
  destroy(): void {
    cancelAnimationFrame(this.frame);
    this.element.remove();
  }
  private setSelected(id: string): void {
    this.summary.textContent = `Character: ${PLAYER_MODELS.find((m) => m.id === id)?.name ?? "Classic Player"}`;
    for (const card of this.cards) {
      card.button.setAttribute("aria-pressed", String(card.id === id));
      card.button.style.borderColor = card.id === id ? "#8cf" : "#526477";
    }
  }
  private async choose(id: string): Promise<void> {
    if (this.busy || !this.onSelect) return;
    this.busy = true;
    for (const c of this.cards) c.button.disabled = true;
    this.status.textContent = "Saving…";
    try {
      await this.onSelect(id);
      this.setSelected(id);
      this.status.textContent = "Character saved.";
    } catch (error) {
      this.status.textContent = `Could not save character. ${String(error)}`;
    } finally {
      this.busy = false;
      for (const c of this.cards) c.button.disabled = false;
    }
  }
  private schedule(): void {
    cancelAnimationFrame(this.frame);
    if (!this.visible || !this.element.open) return;
    this.frame = requestAnimationFrame((time) => {
      this.draw(time);
      this.schedule();
    });
  }
  private draw(time: number): void {
    for (const { id, canvas } of this.cards) {
      const sprite = ENTITY_DEFS[id]?.sprite;
      const sheet = sprite && this.sheets.get(sprite.sheetKey);
      const ctx = canvas.getContext("2d");
      if (!sprite || !sheet || !ctx) continue;
      ctx.clearRect(0, 0, 64, 64);
      ctx.imageSmoothingEnabled = false;
      const col = Math.floor(time / sprite.frameDuration) % sprite.frameCount;
      const row = Math.floor(time / 2000) % 4;
      sheet.drawTile(
        ctx,
        col,
        row,
        (64 - sprite.spriteWidth * 2) / 2,
        64 - sprite.spriteHeight * 2,
        2,
      );
    }
  }
}
