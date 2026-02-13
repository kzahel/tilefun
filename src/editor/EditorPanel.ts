import { TerrainId } from "../autotile/TerrainId.js";
import { RoadType } from "../road/RoadType.js";
import type { BrushMode, PaintMode, SubgridShape } from "./EditorMode.js";

export type EditorTab = "natural" | "road" | "structure" | "entities";

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

const ROW_STYLE =
  "display: flex; flex-wrap: wrap; gap: 4px; align-items: center; padding: 8px 12px;";

interface PaletteEntry {
  terrainId: TerrainId;
  label: string;
  color: string;
}

const NATURAL_PALETTE: PaletteEntry[] = [
  { terrainId: TerrainId.Grass, label: "Grass", color: "#6b935f" },
  { terrainId: TerrainId.ShallowWater, label: "Shlw Water", color: "#4fa4b8" },
  { terrainId: TerrainId.DeepWater, label: "Deep Water", color: "#2a5a8a" },
  { terrainId: TerrainId.Sand, label: "Sand", color: "#c8a84e" },
  { terrainId: TerrainId.SandLight, label: "Lt Sand", color: "#d4b86a" },
  { terrainId: TerrainId.DirtLight, label: "Lt Dirt", color: "#a08050" },
  { terrainId: TerrainId.DirtWarm, label: "Wrm Dirt", color: "#8b6b3e" },
];

interface RoadPaletteEntry {
  roadType: RoadType;
  label: string;
  color: string;
}

const ROAD_PALETTE: RoadPaletteEntry[] = [
  { roadType: RoadType.Asphalt, label: "Asphalt", color: "#4a4a50" },
  { roadType: RoadType.Sidewalk, label: "Sidewalk", color: "#b0aaaa" },
  { roadType: RoadType.LineWhite, label: "White", color: "#e0e0e0" },
  { roadType: RoadType.LineYellow, label: "Yellow", color: "#d4a030" },
];

const STRUCTURE_PALETTE: PaletteEntry[] = [
  { terrainId: TerrainId.Playground, label: "Play", color: "#c87050" },
  { terrainId: TerrainId.Curb, label: "Curb", color: "#808080" },
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
  { type: "crow", label: "Crow", color: "#333344" },
  { type: "seagull", label: "Seagull", color: "#ccccdd" },
  { type: "fish1", label: "Fish 1", color: "#4fa4b8" },
  { type: "fish2", label: "Fish 2", color: "#3d8ea0" },
  { type: "fish3", label: "Fish 3", color: "#5bb4c8" },
  { type: "campfire", label: "Campfire", color: "#e8601c" },
  { type: "egg-nest", label: "Egg/Nest", color: "#c8a84e" },
  { type: "worm1", label: "Worm 1", color: "#cc6688" },
  { type: "worm2", label: "Worm 2", color: "#88aa44" },
  { type: "worm3", label: "Worm 3", color: "#aa8844" },
  { type: "worm4", label: "Worm 4", color: "#6688aa" },
];

const ALL_TABS: EditorTab[] = ["natural", "road", "structure", "entities"];
const TERRAIN_TABS: EditorTab[] = ["natural", "road", "structure"];

export class EditorPanel {
  private readonly container: HTMLDivElement;
  private readonly tabButtons: Map<EditorTab, HTMLButtonElement> = new Map();
  private readonly toolRow: HTMLDivElement;
  private readonly naturalRow: HTMLDivElement;
  private readonly roadRow: HTMLDivElement;
  private readonly structureRow: HTMLDivElement;
  private readonly entityRow: HTMLDivElement;
  /** All terrain buttons with their entries, for selection highlighting. */
  private readonly terrainButtons: { btn: HTMLButtonElement; entry: PaletteEntry }[] = [];
  private readonly autoButtons: HTMLButtonElement[] = [];
  private readonly terrainWrappers: HTMLDivElement[] = [];
  private readonly entityButtons: HTMLButtonElement[] = [];
  private readonly brushModeButtons: Map<BrushMode, HTMLButtonElement> = new Map();
  private readonly bridgeButton: HTMLButtonElement;
  private readonly subgridSeparator: HTMLDivElement;
  private readonly sizeLabel: HTMLSpanElement;
  private readonly bridgeLabel: HTMLSpanElement;
  private readonly brushSizeButton: HTMLButtonElement;
  private readonly paintModeButtons: Map<PaintMode, HTMLButtonElement> = new Map();
  private pendingClear: TerrainId | null = null;
  private pendingRoadClear = false;
  private readonly roadButtons: { btn: HTMLButtonElement; entry: RoadPaletteEntry }[] = [];
  selectedTerrain: TerrainId | null = TerrainId.Grass;
  selectedRoadType: RoadType = RoadType.Asphalt;
  selectedEntityType = "chicken";
  editorTab: EditorTab = "natural";
  brushMode: BrushMode = "tile";
  paintMode: PaintMode = "positive";
  private _temporaryUnpaint = false;
  /** Subgrid brush shape: 1=1x1, 2=2x2, 3=3x3, "cross"=5-point cross. */
  subgridShape: SubgridShape = 1;
  /** Max bridge insertion depth (0 = no bridging, 1-3 = auto-insert transitions). */
  bridgeDepth = 2;

  constructor() {
    this.container = document.createElement("div");
    this.container.style.cssText = PANEL_STYLE;
    this.container.style.display = "none";

    // --- Tab bar ---
    const tabBar = document.createElement("div");
    tabBar.style.cssText = "display: flex; gap: 2px; padding: 0 8px;";
    for (const tab of ALL_TABS) {
      const btn = document.createElement("button");
      btn.style.cssText = TAB_STYLE;
      btn.textContent =
        tab === "natural"
          ? "Natural"
          : tab === "road"
            ? "Road"
            : tab === "structure"
              ? "Structure"
              : "Entities";
      btn.addEventListener("click", () => this.setTab(tab));
      tabBar.appendChild(btn);
      this.tabButtons.set(tab, btn);
    }
    this.container.appendChild(tabBar);

    // --- Shared tool row (visible for all terrain tabs) ---
    this.toolRow = document.createElement("div");
    this.toolRow.style.cssText = ROW_STYLE;

    this.toolRow.appendChild(this.makeLabel("Brush"));
    const brushModes: { mode: BrushMode; label: string; key: string }[] = [
      { mode: "tile", label: "\u25a0", key: "M" },
      { mode: "subgrid", label: "\u229e", key: "M" },
      { mode: "corner", label: "\u25c7", key: "M" },
    ];
    for (const { mode, label, key } of brushModes) {
      const btn = document.createElement("button");
      btn.style.cssText = BTN_STYLE;
      btn.style.fontSize = "16px";
      btn.textContent = label;
      btn.title = `${mode} brush (${key})`;
      btn.addEventListener("click", () => this.setBrushMode(mode));
      this.toolRow.appendChild(btn);
      this.brushModeButtons.set(mode, btn);
    }
    this.updateBrushModeButtons();

    // Paint mode buttons: Positive / Negative / Unpaint
    this.toolRow.appendChild(this.makeSeparator());
    this.toolRow.appendChild(this.makeLabel("Paint"));
    const paintModes: {
      mode: PaintMode;
      label: string;
      key: string;
      disabled?: boolean;
    }[] = [
      { mode: "positive", label: "+", key: "Z" },
      { mode: "negative", label: "\u2212", key: "X", disabled: true },
      { mode: "unpaint", label: "\u00d7", key: "C" },
    ];
    for (const { mode, label, key, disabled } of paintModes) {
      const btn = document.createElement("button");
      btn.style.cssText = BTN_STYLE;
      btn.textContent = label;
      if (disabled) {
        btn.title = `${mode} mode (${key}) — not yet implemented`;
        btn.disabled = true;
        btn.style.opacity = "0.4";
        btn.style.cursor = "not-allowed";
      } else {
        btn.title = `${mode} mode (${key})`;
        btn.addEventListener("click", () => this.setPaintMode(mode));
      }
      this.toolRow.appendChild(btn);
      this.paintModeButtons.set(mode, btn);
    }
    this.updatePaintModeButtons();
    this.subgridSeparator = this.makeSeparator();
    this.toolRow.appendChild(this.subgridSeparator);
    this.sizeLabel = this.makeLabel("Size");
    this.toolRow.appendChild(this.sizeLabel);

    this.brushSizeButton = document.createElement("button");
    this.brushSizeButton.style.cssText = BTN_STYLE;
    this.brushSizeButton.title = "Subgrid brush shape (S)";
    this.brushSizeButton.addEventListener("click", () => this.cycleBrushShape());
    this.toolRow.appendChild(this.brushSizeButton);
    this.updateBrushSizeButton();

    this.bridgeLabel = this.makeLabel("Bridge");
    this.toolRow.appendChild(this.bridgeLabel);
    this.bridgeButton = document.createElement("button");
    this.bridgeButton.style.cssText = BTN_STYLE;
    this.bridgeButton.title = "Bridge depth: auto-insert transitions (B)";
    this.bridgeButton.addEventListener("click", () => this.cycleBridgeDepth());
    this.toolRow.appendChild(this.bridgeButton);
    this.updateBridgeButton();
    this.updateSubgridToolVisibility();

    this.container.appendChild(this.toolRow);

    // --- Terrain palette rows ---
    this.naturalRow = this.buildTerrainRow(NATURAL_PALETTE);
    this.container.appendChild(this.naturalRow);

    this.roadRow = this.buildRoadRow();
    this.container.appendChild(this.roadRow);

    this.structureRow = this.buildTerrainRow(STRUCTURE_PALETTE);
    this.container.appendChild(this.structureRow);

    // --- Entity row ---
    this.entityRow = document.createElement("div");
    this.entityRow.style.cssText = ROW_STYLE;

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
    const hint = document.createElement("span");
    hint.style.cssText = "font: 10px monospace; color: #aaa;";
    hint.textContent = "Click: place / Right-click: delete";
    this.entityRow.appendChild(hint);

    this.container.appendChild(this.entityRow);

    this.updateTerrainSelection();
    this.updateRoadSelection();
    this.updateEntitySelection();
    this.updateTabDisplay();
    document.body.appendChild(this.container);
  }

  private buildTerrainRow(palette: PaletteEntry[]): HTMLDivElement {
    const row = document.createElement("div");
    row.style.cssText = ROW_STYLE;

    // Auto (smudge) button — always visible
    const autoBtn = document.createElement("button");
    autoBtn.style.cssText = `
      width: 44px; height: 44px; border: 2px solid #555; border-radius: 4px;
      background: #556; color: #cdf; font: bold 9px monospace;
      cursor: pointer; text-shadow: 0 1px 2px rgba(0,0,0,0.8);
      display: flex; align-items: center; justify-content: center;
    `;
    autoBtn.textContent = "Auto";
    autoBtn.title = "Smudge: L-click grows, R-click shrinks";
    autoBtn.addEventListener("click", () => {
      this.selectedTerrain = null;
      this.updateTerrainSelection();
    });
    row.appendChild(autoBtn);
    this.autoButtons.push(autoBtn);

    // Wrapper for terrain-specific elements (hidden when Auto selected)
    const wrapper = document.createElement("div");
    wrapper.style.display = "contents";
    this.terrainWrappers.push(wrapper);

    for (const entry of palette) {
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
      this.terrainButtons.push({ btn, entry });
      wrapper.appendChild(btn);
    }

    wrapper.appendChild(this.makeSeparator());

    const clearBtn = document.createElement("button");
    clearBtn.style.cssText = `
      height: 44px; border: 2px solid #555; border-radius: 4px;
      background: #333; color: #fff; font: bold 10px monospace;
      cursor: pointer; padding: 0 12px;
    `;
    clearBtn.textContent = "Clear";
    clearBtn.title = "Fill all chunks with selected terrain";
    let confirmTimer = 0;
    clearBtn.addEventListener("click", () => {
      if (clearBtn.dataset.confirm === "1") {
        this.pendingClear = this.selectedTerrain;
        clearBtn.textContent = "Clear";
        clearBtn.style.borderColor = "#555";
        clearBtn.style.background = "#333";
        delete clearBtn.dataset.confirm;
        window.clearTimeout(confirmTimer);
      } else {
        clearBtn.dataset.confirm = "1";
        clearBtn.textContent = "Sure?";
        clearBtn.style.borderColor = "#f55";
        clearBtn.style.background = "#633";
        confirmTimer = window.setTimeout(() => {
          clearBtn.textContent = "Clear";
          clearBtn.style.borderColor = "#555";
          clearBtn.style.background = "#333";
          delete clearBtn.dataset.confirm;
        }, 2000);
      }
    });
    wrapper.appendChild(clearBtn);

    row.appendChild(wrapper);
    return row;
  }

  private buildRoadRow(): HTMLDivElement {
    const row = document.createElement("div");
    row.style.cssText = ROW_STYLE;

    for (const entry of ROAD_PALETTE) {
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
        this.selectedRoadType = entry.roadType;
        this.updateRoadSelection();
      });
      this.roadButtons.push({ btn, entry });
      row.appendChild(btn);
    }

    row.appendChild(this.makeSeparator());

    const clearBtn = document.createElement("button");
    clearBtn.style.cssText = `
      height: 44px; border: 2px solid #555; border-radius: 4px;
      background: #333; color: #fff; font: bold 10px monospace;
      cursor: pointer; padding: 0 12px;
    `;
    clearBtn.textContent = "Clear";
    clearBtn.title = "Clear all roads";
    let confirmTimer = 0;
    clearBtn.addEventListener("click", () => {
      if (clearBtn.dataset.confirm === "1") {
        this.pendingRoadClear = true;
        clearBtn.textContent = "Clear";
        clearBtn.style.borderColor = "#555";
        clearBtn.style.background = "#333";
        delete clearBtn.dataset.confirm;
        window.clearTimeout(confirmTimer);
      } else {
        clearBtn.dataset.confirm = "1";
        clearBtn.textContent = "Sure?";
        clearBtn.style.borderColor = "#f55";
        clearBtn.style.background = "#633";
        confirmTimer = window.setTimeout(() => {
          clearBtn.textContent = "Clear";
          clearBtn.style.borderColor = "#555";
          clearBtn.style.background = "#333";
          delete clearBtn.dataset.confirm;
        }, 2000);
      }
    });
    row.appendChild(clearBtn);

    return row;
  }

  private makeSeparator(): HTMLDivElement {
    const sep = document.createElement("div");
    sep.style.cssText = "width: 1px; height: 32px; background: #555; margin: 0 4px;";
    return sep;
  }

  private makeLabel(text: string): HTMLSpanElement {
    const lbl = document.createElement("span");
    lbl.style.cssText = "font: 9px monospace; color: #888; margin-right: 2px;";
    lbl.textContent = text;
    return lbl;
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
    const idx = ALL_TABS.indexOf(this.editorTab);
    this.setTab(ALL_TABS[(idx + 1) % ALL_TABS.length] ?? "natural");
  }

  private updateTabDisplay(): void {
    const active = "background: #555; color: #fff;";
    const inactive = "background: #222; color: #888;";
    for (const [tab, btn] of this.tabButtons) {
      btn.style.cssText = TAB_STYLE + (tab === this.editorTab ? active : inactive);
    }
    // Road tab uses tile-only painting — hide tool row (brush modes, subgrid tools)
    const isTerrainTab = TERRAIN_TABS.includes(this.editorTab);
    const isRoad = this.editorTab === "road";
    this.toolRow.style.display = isTerrainTab && !isRoad ? "flex" : "none";
    this.naturalRow.style.display = this.editorTab === "natural" ? "flex" : "none";
    this.roadRow.style.display = isRoad ? "flex" : "none";
    this.structureRow.style.display = this.editorTab === "structure" ? "flex" : "none";
    this.entityRow.style.display = this.editorTab === "entities" ? "flex" : "none";
  }

  setBrushMode(mode: BrushMode): void {
    this.brushMode = mode;
    this.updateBrushModeButtons();
    this.updateSubgridToolVisibility();
  }

  toggleMode(): void {
    if (this.brushMode === "tile") {
      this.setBrushMode("subgrid");
    } else if (this.brushMode === "subgrid") {
      this.setBrushMode("corner");
    } else {
      this.setBrushMode("tile");
    }
  }

  private updateBrushModeButtons(): void {
    for (const [mode, btn] of this.brushModeButtons) {
      const active = mode === this.brushMode;
      btn.style.borderColor = active ? "#fff" : "#555";
      btn.style.background = active ? "#555" : "#444";
    }
  }

  private updateSubgridToolVisibility(): void {
    const show = this.brushMode !== "tile";
    const d = show ? "" : "none";
    this.subgridSeparator.style.display = d;
    this.sizeLabel.style.display = d;
    this.brushSizeButton.style.display = d;
    this.bridgeLabel.style.display = d;
    this.bridgeButton.style.display = d;
  }

  /** The paint mode actually in effect (accounts for right-click temporary unpaint). */
  get effectivePaintMode(): PaintMode {
    return this._temporaryUnpaint ? "unpaint" : this.paintMode;
  }

  /** Set temporary unpaint override (while right-click held). */
  setTemporaryUnpaint(active: boolean): void {
    if (this._temporaryUnpaint !== active) {
      this._temporaryUnpaint = active;
      this.updatePaintModeButtons();
    }
  }

  setPaintMode(mode: PaintMode): void {
    this.paintMode = mode;
    this.updatePaintModeButtons();
  }

  cycleBrushShape(): void {
    if (this.subgridShape === 1) this.subgridShape = 2;
    else if (this.subgridShape === 2) this.subgridShape = 3;
    else if (this.subgridShape === 3) this.subgridShape = "cross";
    else this.subgridShape = 1;
    this.updateBrushSizeButton();
  }

  cycleBridgeDepth(): void {
    this.bridgeDepth = (this.bridgeDepth + 1) % 4; // 0, 1, 2, 3
    this.updateBridgeButton();
  }

  private updatePaintModeButtons(): void {
    const colors: Record<PaintMode, string> = {
      positive: "#4a4",
      negative: "#c84",
      unpaint: "#f55",
    };
    const effective = this.effectivePaintMode;
    for (const [mode, btn] of this.paintModeButtons) {
      const active = mode === effective;
      btn.style.borderColor = active ? colors[mode] : "#555";
      btn.style.background = active ? "#555" : "#444";
    }
  }

  private updateBrushSizeButton(): void {
    const label =
      this.subgridShape === "cross"
        ? "+"
        : this.subgridShape === 1
          ? "1x1"
          : `${this.subgridShape}x${this.subgridShape}`;
    this.brushSizeButton.textContent = label;
    this.brushSizeButton.style.borderColor = this.subgridShape !== 1 ? "#a4f" : "#888";
  }

  private updateBridgeButton(): void {
    const label = this.bridgeDepth === 0 ? "B:Off" : `B:${this.bridgeDepth}`;
    this.bridgeButton.textContent = label;
    this.bridgeButton.style.borderColor = this.bridgeDepth > 0 ? "#4a9" : "#888";
  }

  /** Numeric brush size for backward compat. Cross returns 1 (handled separately). */
  get brushSize(): 1 | 2 | 3 {
    return typeof this.subgridShape === "number" ? this.subgridShape : 1;
  }

  consumeClearRequest(): TerrainId | null {
    const c = this.pendingClear;
    this.pendingClear = null;
    return c;
  }

  consumeRoadClearRequest(): boolean {
    const c = this.pendingRoadClear;
    this.pendingRoadClear = false;
    return c;
  }

  private updateTerrainSelection(): void {
    const isAuto = this.selectedTerrain === null;
    for (const { btn, entry } of this.terrainButtons) {
      btn.style.borderColor = entry.terrainId === this.selectedTerrain ? "#fff" : "#555";
      btn.style.boxShadow =
        entry.terrainId === this.selectedTerrain ? "0 0 6px rgba(255,255,255,0.5)" : "none";
    }
    for (const btn of this.autoButtons) {
      btn.style.borderColor = isAuto ? "#fff" : "#555";
      btn.style.boxShadow = isAuto ? "0 0 6px rgba(255,255,255,0.5)" : "none";
    }
    for (const wrapper of this.terrainWrappers) {
      wrapper.style.display = isAuto ? "none" : "contents";
    }
  }

  private updateRoadSelection(): void {
    for (const { btn, entry } of this.roadButtons) {
      btn.style.borderColor = entry.roadType === this.selectedRoadType ? "#fff" : "#555";
      btn.style.boxShadow =
        entry.roadType === this.selectedRoadType ? "0 0 6px rgba(255,255,255,0.5)" : "none";
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
