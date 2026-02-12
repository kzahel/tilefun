import { TerrainId } from "../autotile/TerrainId.js";
import type { BrushMode } from "./EditorMode.js";

export type EditorTab = "terrain" | "entities";

const PANEL_STYLE = `
  position: fixed; bottom: 8px; left: 50%; transform: translateX(-50%);
  background: rgba(0,0,0,0.8); color: #fff;
  font: 13px monospace; padding: 0;
  border-radius: 6px; z-index: 100;
  display: none; user-select: none;
  flex-direction: column;
`;

const BTN_STYLE = `
  height: 44px; border: 2px solid #888; border-radius: 4px;
  background: #444; color: #fff; font: bold 10px monospace;
  cursor: pointer; padding: 0 10px;
`;

const TAB_STYLE = `
  padding: 6px 16px; border: none; border-radius: 6px 6px 0 0;
  font: bold 11px monospace; cursor: pointer;
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
];

interface EntityPaletteEntry {
  type: string;
  label: string;
  color: string;
}

const ENTITY_PALETTE: EntityPaletteEntry[] = [
  { type: "chicken", label: "Chicken", color: "#f0c040" },
  { type: "cow", label: "Cow", color: "#d4a880" },
  { type: "pigeon", label: "Pigeon", color: "#8888cc" },
  { type: "pigeon2", label: "Pigeon 2", color: "#9999aa" },
  { type: "fish1", label: "Fish 1", color: "#4fa4b8" },
  { type: "fish2", label: "Fish 2", color: "#3d8ea0" },
  { type: "fish3", label: "Fish 3", color: "#5bb4c8" },
  { type: "campfire", label: "Campfire", color: "#e8601c" },
  { type: "egg-nest", label: "Egg/Nest", color: "#c8a84e" },
];

export class EditorPanel {
  private readonly container: HTMLDivElement;
  private readonly tabBar: HTMLDivElement;
  private readonly terrainTab: HTMLButtonElement;
  private readonly entitiesTab: HTMLButtonElement;
  private readonly terrainRow: HTMLDivElement;
  private readonly entityRow: HTMLDivElement;
  private readonly terrainButtons: HTMLButtonElement[] = [];
  private readonly entityButtons: HTMLButtonElement[] = [];
  private readonly modeButton: HTMLButtonElement;
  private readonly bridgeButton: HTMLButtonElement;
  private readonly brushSizeButton: HTMLButtonElement;
  private pendingClear: TerrainId | null = null;
  selectedTerrain: TerrainId = TerrainId.Grass;
  selectedEntityType = "chicken";
  editorTab: EditorTab = "terrain";
  brushMode: BrushMode = "tile";
  /** Subgrid brush size: 1=single point, 2=2×2 block, 3=3×3 block. */
  brushSize: 1 | 2 | 3 = 1;
  /** Max bridge insertion depth (0 = no bridging, 1-3 = auto-insert transitions). */
  bridgeDepth = 2;

  constructor() {
    this.container = document.createElement("div");
    this.container.style.cssText = PANEL_STYLE;
    this.container.style.display = "none";

    // --- Tab bar ---
    this.tabBar = document.createElement("div");
    this.tabBar.style.cssText = "display: flex; gap: 2px; padding: 0 8px;";

    this.terrainTab = document.createElement("button");
    this.terrainTab.style.cssText = TAB_STYLE;
    this.terrainTab.textContent = "Terrain";
    this.terrainTab.addEventListener("click", () => this.setTab("terrain"));
    this.tabBar.appendChild(this.terrainTab);

    this.entitiesTab = document.createElement("button");
    this.entitiesTab.style.cssText = TAB_STYLE;
    this.entitiesTab.textContent = "Entities";
    this.entitiesTab.addEventListener("click", () => this.setTab("entities"));
    this.tabBar.appendChild(this.entitiesTab);

    this.container.appendChild(this.tabBar);

    // --- Terrain row ---
    this.terrainRow = document.createElement("div");
    this.terrainRow.style.cssText =
      "display: flex; flex-wrap: wrap; gap: 4px; align-items: center; padding: 8px 12px;";

    // Mode toggle button
    this.modeButton = document.createElement("button");
    this.modeButton.style.cssText = BTN_STYLE;
    this.modeButton.textContent = "Tile";
    this.modeButton.title = "Toggle tile/subgrid brush mode (M)";
    this.modeButton.addEventListener("click", () => this.toggleMode());
    this.terrainRow.appendChild(this.modeButton);

    // Brush size button
    this.brushSizeButton = document.createElement("button");
    this.brushSizeButton.style.cssText = BTN_STYLE;
    this.brushSizeButton.title = "Subgrid brush size (S)";
    this.brushSizeButton.addEventListener("click", () => this.cycleBrushSize());
    this.terrainRow.appendChild(this.brushSizeButton);
    this.updateBrushSizeButton();

    // Bridge depth button
    this.bridgeButton = document.createElement("button");
    this.bridgeButton.style.cssText = BTN_STYLE;
    this.bridgeButton.title = "Bridge depth: auto-insert transitions (B)";
    this.bridgeButton.addEventListener("click", () => this.cycleBridgeDepth());
    this.terrainRow.appendChild(this.bridgeButton);
    this.updateBridgeButton();

    // Separator after controls
    this.terrainRow.appendChild(this.makeSeparator());

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
        this.updateTerrainSelection();
      });
      this.terrainButtons.push(btn);
      this.terrainRow.appendChild(btn);
    }

    this.terrainRow.appendChild(this.makeSeparator());

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
    this.terrainRow.appendChild(clearBtn);

    this.container.appendChild(this.terrainRow);

    // --- Entity row ---
    this.entityRow = document.createElement("div");
    this.entityRow.style.cssText =
      "display: flex; flex-wrap: wrap; gap: 4px; align-items: center; padding: 8px 12px;";

    for (const entry of ENTITY_PALETTE) {
      const btn = document.createElement("button");
      btn.style.cssText = `
        width: 64px; height: 44px; border: 2px solid #555; border-radius: 4px;
        background: ${entry.color}; color: #fff; font: bold 9px monospace;
        cursor: pointer; text-shadow: 0 1px 2px rgba(0,0,0,0.8);
        display: flex; align-items: center; justify-content: center;
      `;
      btn.textContent = entry.label;
      btn.title = `Place ${entry.label} (click map)`;
      btn.addEventListener("click", () => {
        this.selectedEntityType = entry.type;
        this.updateEntitySelection();
      });
      this.entityButtons.push(btn);
      this.entityRow.appendChild(btn);
    }

    this.entityRow.appendChild(this.makeSeparator());

    // Hint text
    const hint = document.createElement("span");
    hint.style.cssText = "font: 10px monospace; color: #aaa;";
    hint.textContent = "Click: place / Right-click: delete";
    this.entityRow.appendChild(hint);

    this.container.appendChild(this.entityRow);

    this.updateTerrainSelection();
    this.updateEntitySelection();
    this.updateTabDisplay();
    document.body.appendChild(this.container);
  }

  private makeSeparator(): HTMLDivElement {
    const sep = document.createElement("div");
    sep.style.cssText = "width: 1px; height: 32px; background: #555; margin: 0 4px;";
    return sep;
  }

  get visible(): boolean {
    return this.container.style.display !== "none";
  }

  set visible(v: boolean) {
    this.container.style.display = v ? "flex" : "none";
  }

  setTab(tab: EditorTab): void {
    this.editorTab = tab;
    this.updateTabDisplay();
  }

  toggleTab(): void {
    this.setTab(this.editorTab === "terrain" ? "entities" : "terrain");
  }

  private updateTabDisplay(): void {
    const active = "background: #555; color: #fff;";
    const inactive = "background: #222; color: #888;";
    this.terrainTab.style.cssText = TAB_STYLE + (this.editorTab === "terrain" ? active : inactive);
    this.entitiesTab.style.cssText =
      TAB_STYLE + (this.editorTab === "entities" ? active : inactive);
    this.terrainRow.style.display = this.editorTab === "terrain" ? "flex" : "none";
    this.entityRow.style.display = this.editorTab === "entities" ? "flex" : "none";
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

  private updateTerrainSelection(): void {
    for (let i = 0; i < PALETTE.length; i++) {
      const btn = this.terrainButtons[i];
      const entry = PALETTE[i];
      if (btn && entry) {
        btn.style.borderColor = entry.terrainId === this.selectedTerrain ? "#fff" : "#555";
        btn.style.boxShadow =
          entry.terrainId === this.selectedTerrain ? "0 0 6px rgba(255,255,255,0.5)" : "none";
      }
    }
  }

  private updateEntitySelection(): void {
    for (let i = 0; i < ENTITY_PALETTE.length; i++) {
      const btn = this.entityButtons[i];
      const entry = ENTITY_PALETTE[i];
      if (btn && entry) {
        btn.style.borderColor = entry.type === this.selectedEntityType ? "#fff" : "#555";
        btn.style.boxShadow =
          entry.type === this.selectedEntityType ? "0 0 6px rgba(255,255,255,0.5)" : "none";
      }
    }
  }
}
