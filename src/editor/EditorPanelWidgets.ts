import type { Spritesheet } from "../assets/Spritesheet.js";
import type { EditorModel } from "./EditorModel.js";

/** What a panel section needs from the panel: the model and a full resync. */
export interface EditorSectionHost {
  readonly model: EditorModel;
  /** Re-render every section from the model (after direct model field writes). */
  sync(): void;
}

/** One group of palette rows, appended to the scroll area in `rows` order. */
export interface EditorSection {
  readonly rows: readonly HTMLElement[];
  /** Apply model state: row visibility and selection highlighting. */
  sync(): void;
}

export const BTN_STYLE = `
  height: 44px; border: 2px solid #888; border-radius: 4px;
  background: #444; color: #fff; font: bold 10px monospace;
  cursor: pointer; padding: 0 10px;
`;

export const ROW_STYLE =
  "display: flex; flex-wrap: wrap; gap: 4px; align-items: center; padding: 8px 12px;";

const SELECTED_GLOW = "0 0 6px rgba(255,255,255,0.5)";

/** Square swatch/sprite palette button style. */
export function paletteButtonStyle(background: string, color = "#fff", width = 44): string {
  return `
      width: ${width}px; height: 44px; border: 2px solid #555; border-radius: 4px;
      background: ${background}; color: ${color}; font: bold 9px monospace;
      cursor: pointer; text-shadow: 0 1px 2px rgba(0,0,0,0.8);
      display: flex; align-items: center; justify-content: center;
    `;
}

/** White border plus glow for the selected palette button, grey otherwise. */
export function highlight(button: HTMLElement, active: boolean): void {
  button.style.borderColor = active ? "#fff" : "#555";
  button.style.boxShadow = active ? SELECTED_GLOW : "none";
}

export function makeSeparator(): HTMLDivElement {
  const sep = document.createElement("div");
  sep.style.cssText = "width: 1px; height: 32px; background: #555; margin: 0 4px;";
  return sep;
}

export function makeLabel(text: string): HTMLSpanElement {
  const lbl = document.createElement("span");
  lbl.style.cssText = "font: 9px monospace; color: #888; margin-right: 2px;";
  lbl.textContent = text;
  return lbl;
}

export function makeRow(): HTMLDivElement {
  const row = document.createElement("div");
  row.style.cssText = ROW_STYLE;
  return row;
}

function resetClearButton(button: HTMLButtonElement): void {
  button.textContent = "Clear";
  button.style.borderColor = "#555";
  button.style.background = "#333";
  delete button.dataset.confirm;
}

/** "Clear" button that asks "Sure?" and only acts on a second tap within two seconds. */
export function makeConfirmClearButton(title: string, clear: () => void): HTMLButtonElement {
  const clearBtn = document.createElement("button");
  clearBtn.style.cssText = `
      height: 44px; border: 2px solid #555; border-radius: 4px;
      background: #333; color: #fff; font: bold 10px monospace;
      cursor: pointer; padding: 0 12px;
    `;
  clearBtn.textContent = "Clear";
  clearBtn.title = title;
  let confirmTimer = 0;
  clearBtn.addEventListener("click", () => {
    if (clearBtn.dataset.confirm === "1") {
      clear();
      resetClearButton(clearBtn);
      window.clearTimeout(confirmTimer);
    } else {
      clearBtn.dataset.confirm = "1";
      clearBtn.textContent = "Sure?";
      clearBtn.style.borderColor = "#f55";
      clearBtn.style.background = "#633";
      confirmTimer = window.setTimeout(() => resetClearButton(clearBtn), 2000);
    }
  });
  return clearBtn;
}

/** Delete-mode toggles shared by one section's rows. */
export class DeleteToggles {
  private readonly buttons: HTMLButtonElement[] = [];

  constructor(private readonly host: EditorSectionHost) {}

  create(): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.style.cssText = `
      height: 44px; border: 2px solid #555; border-radius: 4px;
      background: #444; color: #fff; font: bold 10px monospace;
      cursor: pointer; padding: 0 12px;
    `;
    btn.textContent = "Delete";
    btn.title = "Toggle delete mode (tap to remove)";
    btn.addEventListener("click", () => {
      this.host.model.deleteMode = !this.host.model.deleteMode;
      this.host.sync();
    });
    this.buttons.push(btn);
    return btn;
  }

  sync(): void {
    const deleteMode = this.host.model.deleteMode;
    for (const btn of this.buttons) {
      btn.style.borderColor = deleteMode ? "#f55" : "#555";
      btn.style.background = deleteMode ? "#633" : "#444";
    }
  }
}

type Region = { x: number; y: number; width: number; height: number };

/** Find visible pixels in the initial pose without changing the gameplay sheet. */
export function opaqueRegion(sheet: Spritesheet, row: number, col = 0): Region {
  const region = sheet.getRegion(col, row);
  const frame = document.createElement("canvas");
  frame.width = region.width;
  frame.height = region.height;
  const ctx = frame.getContext("2d", { willReadFrequently: true });
  if (!ctx) return region;
  ctx.drawImage(
    sheet.image,
    region.x,
    region.y,
    region.width,
    region.height,
    0,
    0,
    frame.width,
    frame.height,
  );
  const pixels = ctx.getImageData(0, 0, frame.width, frame.height).data;
  let left = frame.width;
  let top = frame.height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < frame.height; y++) {
    for (let x = 0; x < frame.width; x++) {
      if (!pixels[(y * frame.width + x) * 4 + 3]) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  return right < left
    ? region
    : {
        x: region.x + left,
        y: region.y + top,
        width: right - left + 1,
        height: bottom - top + 1,
      };
}

/** Draw a spritesheet tile into a canvas inside a button. */
export function renderPreviewCanvas(
  btn: HTMLButtonElement,
  sheet: Spritesheet,
  col: number,
  row: number,
  btnW: number,
  btnH: number,
  source?: Region,
): void {
  const canvas = document.createElement("canvas");
  const pad = 4; // account for border
  const cw = btnW - pad;
  const ch = btnH - pad;
  canvas.width = cw;
  canvas.height = ch;
  canvas.style.cssText = "pointer-events: none; image-rendering: pixelated;";
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;

  const region = source ?? sheet.getRegion(col, row);
  // Scale sprite to fit canvas, centered
  const scaleX = cw / region.width;
  const scaleY = ch / region.height;
  const scale = Math.min(scaleX, scaleY);
  const dw = region.width * scale;
  const dh = region.height * scale;
  const dx = (cw - dw) / 2;
  const dy = (ch - dh) / 2;

  ctx.drawImage(sheet.image, region.x, region.y, region.width, region.height, dx, dy, dw, dh);

  btn.textContent = "";
  btn.style.background = "transparent";
  btn.style.display = "flex";
  btn.style.alignItems = "center";
  btn.style.justifyContent = "center";
  btn.appendChild(canvas);
}
