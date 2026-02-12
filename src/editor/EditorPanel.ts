import { TerrainId } from "../autotile/TerrainId.js";
import type { BrushMode } from "./EditorMode.js";

const PANEL_STYLE = `
  position: fixed; bottom: 8px; left: 50%; transform: translateX(-50%);
  background: rgba(0,0,0,0.8); color: #fff;
  font: 13px monospace; padding: 8px 12px;
  border-radius: 6px; z-index: 100;
  display: none; user-select: none;
  display: flex; flex-wrap: wrap; gap: 4px; align-items: center;
`;

const BTN_STYLE = `
  height: 44px; border: 2px solid #888; border-radius: 4px;
  background: #444; color: #fff; font: bold 10px monospace;
  cursor: pointer; padding: 0 10px;
`;

interface PaletteEntry {
  terrainId: TerrainId;
  label: string;
  color: string;
}

const PALETTE: PaletteEntry[] = [
  { terrainId: TerrainId.Grass, label: "Grass", color: "#6b935f" },
  { terrainId: TerrainId.ShallowWater, label: "Water", color: "#4fa4b8" },
  { terrainId: TerrainId.DeepWater, label: "Deep", color: "#2a5a8a" },
  { terrainId: TerrainId.Sand, label: "Sand", color: "#c8a84e" },
  { terrainId: TerrainId.SandLight, label: "Lt Sand", color: "#d4b86a" },
  { terrainId: TerrainId.DirtLight, label: "Lt Dirt", color: "#a08050" },
  { terrainId: TerrainId.DirtWarm, label: "Dirt", color: "#8b6b3e" },
  { terrainId: TerrainId.DebugGreen, label: "Debug", color: "#4a9a3a" },
];

export class EditorPanel {
  private readonly container: HTMLDivElement;
  private readonly buttons: HTMLButtonElement[] = [];
  private readonly modeButton: HTMLButtonElement;
  private readonly bridgeButton: HTMLButtonElement;
  private readonly brushSizeButton: HTMLButtonElement;
  private pendingClear: TerrainId | null = null;
  selectedTerrain: TerrainId = TerrainId.Grass;
  brushMode: BrushMode = "tile";
  /** Subgrid brush size: 1=single point, 2=2×2 block, 3=3×3 block. */
  brushSize: 1 | 2 | 3 = 1;
  /** Max bridge insertion depth (0 = no bridging, 1-3 = auto-insert transitions). */
  bridgeDepth = 2;

  constructor() {
    this.container = document.createElement("div");
    this.container.style.cssText = PANEL_STYLE;
    this.container.style.display = "none";

    // Mode toggle button
    this.modeButton = document.createElement("button");
    this.modeButton.style.cssText = BTN_STYLE;
    this.modeButton.textContent = "Tile";
    this.modeButton.title = "Toggle tile/subgrid brush mode (M)";
    this.modeButton.addEventListener("click", () => this.toggleMode());
    this.container.appendChild(this.modeButton);

    // Brush size button (subgrid mode only)
    this.brushSizeButton = document.createElement("button");
    this.brushSizeButton.style.cssText = BTN_STYLE;
    this.brushSizeButton.title = "Subgrid brush size (S)";
    this.brushSizeButton.addEventListener("click", () => this.cycleBrushSize());
    this.container.appendChild(this.brushSizeButton);
    this.updateBrushSizeButton();

    // Bridge depth button
    this.bridgeButton = document.createElement("button");
    this.bridgeButton.style.cssText = BTN_STYLE;
    this.bridgeButton.title = "Bridge depth: auto-insert transitions (B)";
    this.bridgeButton.addEventListener("click", () => this.cycleBridgeDepth());
    this.container.appendChild(this.bridgeButton);
    this.updateBridgeButton();

    // Separator after controls
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
        this.selectedTerrain = entry.terrainId;
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
    if (this.brushMode === "tile") {
      this.brushMode = "corner";
    } else if (this.brushMode === "corner") {
      this.brushMode = "subgrid";
    } else {
      this.brushMode = "tile";
    }
    this.updateModeButton();
  }

  private updateModeButton(): void {
    const labels: Record<BrushMode, string> = {
      tile: "Tile",
      corner: "Corner",
      subgrid: "Grid",
    };
    this.modeButton.textContent = labels[this.brushMode];
    const colors: Record<BrushMode, string> = {
      tile: "#888",
      corner: "#50c8ff",
      subgrid: "#f0a030",
    };
    this.modeButton.style.borderColor = colors[this.brushMode];
  }

  cycleBrushSize(): void {
    if (this.brushSize === 1) this.brushSize = 2;
    else if (this.brushSize === 2) this.brushSize = 3;
    else this.brushSize = 1;
    this.updateBrushSizeButton();
  }

  cycleBridgeDepth(): void {
    this.bridgeDepth = (this.bridgeDepth + 1) % 4; // 0, 1, 2, 3
    this.updateBridgeButton();
  }

  private updateBrushSizeButton(): void {
    const label = this.brushSize === 1 ? "1x1" : `${this.brushSize}x${this.brushSize}`;
    this.brushSizeButton.textContent = label;
    this.brushSizeButton.style.borderColor = this.brushSize > 1 ? "#a4f" : "#888";
  }

  private updateBridgeButton(): void {
    const label = this.bridgeDepth === 0 ? "B:Off" : `B:${this.bridgeDepth}`;
    this.bridgeButton.textContent = label;
    this.bridgeButton.style.borderColor = this.bridgeDepth > 0 ? "#4a9" : "#888";
  }

  consumeClearRequest(): TerrainId | null {
    const c = this.pendingClear;
    this.pendingClear = null;
    return c;
  }

  private updateSelection(): void {
    for (let i = 0; i < PALETTE.length; i++) {
      const btn = this.buttons[i];
      const entry = PALETTE[i];
      if (btn && entry) {
        btn.style.borderColor = entry.terrainId === this.selectedTerrain ? "#fff" : "#555";
        btn.style.boxShadow =
          entry.terrainId === this.selectedTerrain ? "0 0 6px rgba(255,255,255,0.5)" : "none";
      }
    }
  }
}
