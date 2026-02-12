import { TileId } from "../world/TileRegistry.js";
import type { BrushMode } from "./EditorMode.js";

const PANEL_STYLE = `
  position: fixed; bottom: 8px; left: 50%; transform: translateX(-50%);
  background: rgba(0,0,0,0.8); color: #fff;
  font: 13px monospace; padding: 8px 12px;
  border-radius: 6px; z-index: 100;
  display: none; user-select: none;
  display: flex; flex-wrap: wrap; gap: 4px; align-items: center;
`;

interface PaletteEntry {
  tileId: TileId;
  label: string;
  color: string;
}

const PALETTE: PaletteEntry[] = [
  { tileId: TileId.Grass, label: "Grass", color: "#6b935f" },
  { tileId: TileId.Water, label: "Water", color: "#4fa4b8" },
  { tileId: TileId.DeepWater, label: "Deep", color: "#2a5a8a" },
  { tileId: TileId.Sand, label: "Sand", color: "#c8a84e" },
  { tileId: TileId.Forest, label: "Forest", color: "#4a7a3f" },
  { tileId: TileId.DenseForest, label: "Dense", color: "#2d5a28" },
  { tileId: TileId.DirtPath, label: "Dirt", color: "#8b6b3e" },
  { tileId: TileId.Empty, label: "Empty", color: "#1a1a2e" },
];

export class EditorPanel {
  private readonly container: HTMLDivElement;
  private readonly buttons: HTMLButtonElement[] = [];
  private readonly modeButton: HTMLButtonElement;
  private pendingClear: TileId | null = null;
  selectedTerrain: TileId = TileId.Grass;
  brushMode: BrushMode = "tile";

  constructor() {
    this.container = document.createElement("div");
    this.container.style.cssText = PANEL_STYLE;
    this.container.style.display = "none";

    // Mode toggle button
    this.modeButton = document.createElement("button");
    this.modeButton.style.cssText = `
      height: 44px; border: 2px solid #888; border-radius: 4px;
      background: #444; color: #fff; font: bold 10px monospace;
      cursor: pointer; padding: 0 10px;
    `;
    this.modeButton.textContent = "Tile";
    this.modeButton.title = "Toggle tile/corner brush mode (M)";
    this.modeButton.addEventListener("click", () => this.toggleMode());
    this.container.appendChild(this.modeButton);

    // Separator after mode button
    const modeSep = document.createElement("div");
    modeSep.style.cssText = "width: 1px; height: 32px; background: #555; margin: 0 4px;";
    this.container.appendChild(modeSep);

    for (const entry of PALETTE) {
      const btn = document.createElement("button");
      btn.style.cssText = `
        width: 44px; height: 44px; border: 2px solid #555; border-radius: 4px;
        background: ${entry.color}; color: #fff; font: bold 9px monospace;
        cursor: pointer; text-shadow: 0 1px 2px rgba(0,0,0,0.8);
        display: flex; align-items: center; justify-content: center;
      `;
      btn.textContent = entry.label;
      btn.title = entry.label;
      btn.addEventListener("click", () => {
        this.selectedTerrain = entry.tileId;
        this.updateSelection();
      });
      this.buttons.push(btn);
      this.container.appendChild(btn);
    }

    // Separator
    const sep = document.createElement("div");
    sep.style.cssText = "width: 1px; height: 32px; background: #555; margin: 0 4px;";
    this.container.appendChild(sep);

    // Clear button
    const clearBtn = document.createElement("button");
    clearBtn.style.cssText = `
      height: 44px; border: 2px solid #555; border-radius: 4px;
      background: #333; color: #fff; font: bold 10px monospace;
      cursor: pointer; padding: 0 12px;
    `;
    clearBtn.textContent = "Clear";
    clearBtn.title = "Fill all chunks with selected terrain";
    clearBtn.addEventListener("click", () => {
      this.pendingClear = this.selectedTerrain;
    });
    this.container.appendChild(clearBtn);

    this.updateSelection();
    document.body.appendChild(this.container);
  }

  get visible(): boolean {
    return this.container.style.display !== "none";
  }

  set visible(v: boolean) {
    this.container.style.display = v ? "flex" : "none";
  }

  toggleMode(): void {
    this.brushMode = this.brushMode === "tile" ? "corner" : "tile";
    this.modeButton.textContent = this.brushMode === "tile" ? "Tile" : "Corner";
    this.modeButton.style.borderColor = this.brushMode === "corner" ? "#f0a030" : "#888";
  }

  consumeClearRequest(): TileId | null {
    const c = this.pendingClear;
    this.pendingClear = null;
    return c;
  }

  private updateSelection(): void {
    for (let i = 0; i < PALETTE.length; i++) {
      const btn = this.buttons[i];
      const entry = PALETTE[i];
      if (btn && entry) {
        btn.style.borderColor = entry.tileId === this.selectedTerrain ? "#fff" : "#555";
        btn.style.boxShadow =
          entry.tileId === this.selectedTerrain ? "0 0 6px rgba(255,255,255,0.5)" : "none";
      }
    }
  }
}
