import type { Spritesheet } from "../assets/Spritesheet.js";
import type { BlendGraph } from "../autotile/BlendGraph.js";
import { TerrainId, VariantId } from "../autotile/TerrainId.js";
import { MAX_ELEVATION } from "../config/constants.js";
import { RoadType } from "../road/RoadType.js";
import type { BrushMode, PaintMode, SubgridShape } from "./EditorMode.js";

export type EditorTab = "natural" | "road" | "structure" | "entities" | "elevation";

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

interface SheetPaletteEntry {
  sheetKey: string;
  label: string;
  storedValue: number;
}

const NATURAL_SHEET_PALETTE: SheetPaletteEntry[] = [
  { sheetKey: "me16", label: "Deep/Shlw", storedValue: TerrainId.DeepWater },
  { sheetKey: "me03", label: "Shlw/Grass", storedValue: VariantId.ShallowWaterOnGrass },
  { sheetKey: "me08", label: "Sand/Shlw", storedValue: TerrainId.Sand },
  { sheetKey: "me09", label: "Sand/SandL", storedValue: TerrainId.Sand },
  { sheetKey: "me07", label: "SandL/Grass", storedValue: TerrainId.SandLight },
  { sheetKey: "me01", label: "DirtL/Grass", storedValue: TerrainId.DirtLight },
  { sheetKey: "me02", label: "DirtW/Grass", storedValue: TerrainId.DirtWarm },
  { sheetKey: "me12", label: "Grass/DirtW", storedValue: VariantId.GrassOnDirtWarm },
  { sheetKey: "me15", label: "Grass/Shlw", storedValue: TerrainId.Grass },
  // Alpha variants (prefer overlay behavior)
  { sheetKey: "me13", label: "Grass\u03b1", storedValue: VariantId.GrassAlpha },
  { sheetKey: "me10", label: "Sand\u03b1", storedValue: VariantId.SandAlpha },
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
  ...Array.from({ length: 20 }, (_, i) => ({
    type: `person${i + 1}`,
    label: `Person ${i + 1}`,
    color: "#b89070",
  })),
];

const ALL_TABS: EditorTab[] = ["natural", "road", "structure", "entities", "elevation"];
const TERRAIN_TABS: EditorTab[] = ["natural", "road", "structure"];

const ELEVATION_GRID_SIZES = [1, 2, 3, 4] as const;
const ELEVATION_COLORS = ["#888", "#9a6", "#c84", "#e44"];

export class EditorPanel {
  private readonly container: HTMLDivElement;
  private readonly tabButtons: Map<EditorTab, HTMLButtonElement> = new Map();
  private readonly toolRow: HTMLDivElement;
  private readonly naturalRow: HTMLDivElement;
  private readonly roadRow: HTMLDivElement;
  private readonly structureRow: HTMLDivElement;
  private readonly entityRow: HTMLDivElement;
  private readonly elevationRow: HTMLDivElement;
  private readonly elevationHeightButtons: HTMLButtonElement[] = [];
  private readonly elevationGridButtons: HTMLButtonElement[] = [];
  /** Structure terrain buttons with their entries, for selection highlighting. */
  private readonly terrainButtons: { btn: HTMLButtonElement; entry: PaletteEntry }[] = [];
  private readonly naturalPaletteButtons: HTMLButtonElement[] = [];
  private selectedNaturalIndex = 8;
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
  private pendingClear: number | null = null;
  private pendingRoadClear = false;
  private readonly roadButtons: { btn: HTMLButtonElement; entry: RoadPaletteEntry }[] = [];
  selectedTerrain: number | null = TerrainId.Grass;
  selectedRoadType: RoadType = RoadType.Asphalt;
  selectedEntityType = "chicken";
  selectedElevation = 1;
  elevationGridSize = 1;
  editorTab: EditorTab = "natural";
  brushMode: BrushMode = "tile";
  paintMode: PaintMode = "positive";
  private _temporaryUnpaint = false;
  /** Subgrid brush shape: 1=1x1, 2=2x2, 3=3x3, "cross"=5-point cross. */
  subgridShape: SubgridShape = 1;
  /** Max bridge insertion depth (0 = no bridging, 1-3 = auto-insert transitions). */
  bridgeDepth = 0;

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
      const TAB_LABELS: Record<EditorTab, string> = {
        natural: "Natural",
        road: "Road",
        structure: "Structure",
        entities: "Entities",
        elevation: "Elevation",
      };
      btn.textContent = TAB_LABELS[tab];
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
      { mode: "cross", label: "\u271a", key: "M" },
      { mode: "x", label: "\u2716", key: "M" },
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

    // Paint mode buttons: Positive / Unpaint
    this.toolRow.appendChild(this.makeSeparator());
    this.toolRow.appendChild(this.makeLabel("Paint"));
    const paintModes: {
      mode: PaintMode;
      label: string;
      key: string;
    }[] = [
      { mode: "positive", label: "+", key: "Z" },
      { mode: "unpaint", label: "\u00d7", key: "C" },
    ];
    for (const { mode, label, key } of paintModes) {
      const btn = document.createElement("button");
      btn.style.cssText = BTN_STYLE;
      btn.textContent = label;
      btn.title = `${mode} mode (${key})`;
      btn.addEventListener("click", () => this.setPaintMode(mode));
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
    this.naturalRow = this.buildNaturalRow();
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

    // --- Elevation row ---
    this.elevationRow = document.createElement("div");
    this.elevationRow.style.cssText = ROW_STYLE;

    this.elevationRow.appendChild(this.makeLabel("Height"));
    for (let h = 0; h <= MAX_ELEVATION; h++) {
      const btn = document.createElement("button");
      btn.style.cssText = BTN_STYLE;
      btn.style.width = "44px";
      btn.style.background = ELEVATION_COLORS[h] ?? "#888";
      btn.textContent = `${h}`;
      btn.title = h === 0 ? "Flatten (height 0)" : `Set height ${h}`;
      btn.addEventListener("click", () => {
        this.selectedElevation = h;
        this.updateElevationSelection();
      });
      this.elevationHeightButtons.push(btn);
      this.elevationRow.appendChild(btn);
    }

    this.elevationRow.appendChild(this.makeSeparator());
    this.elevationRow.appendChild(this.makeLabel("Grid"));
    for (const size of ELEVATION_GRID_SIZES) {
      const btn = document.createElement("button");
      btn.style.cssText = BTN_STYLE;
      btn.style.width = "44px";
      btn.textContent = `${size}x${size}`;
      btn.title = `Paint ${size}x${size} tile area`;
      btn.addEventListener("click", () => {
        this.elevationGridSize = size;
        this.updateElevationSelection();
      });
      this.elevationGridButtons.push(btn);
      this.elevationRow.appendChild(btn);
    }

    this.elevationRow.appendChild(this.makeSeparator());
    const elevHint = document.createElement("span");
    elevHint.style.cssText = "font: 10px monospace; color: #aaa;";
    elevHint.textContent = "Click: set height / Right-click: flatten";
    this.elevationRow.appendChild(elevHint);

    this.container.appendChild(this.elevationRow);

    this.updateTerrainSelection();
    this.updateRoadSelection();
    this.updateEntitySelection();
    this.updateElevationSelection();
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
      this.selectedNaturalIndex = -1;
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
        this.selectedNaturalIndex = -1;
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

  private buildNaturalRow(): HTMLDivElement {
    const row = document.createElement("div");
    row.style.cssText = ROW_STYLE;

    // Auto (smudge) button
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
      this.selectedNaturalIndex = -1;
      this.updateTerrainSelection();
    });
    row.appendChild(autoBtn);
    this.autoButtons.push(autoBtn);

    const wrapper = document.createElement("div");
    wrapper.style.display = "contents";
    this.terrainWrappers.push(wrapper);

    for (let i = 0; i < NATURAL_SHEET_PALETTE.length; i++) {
      const entry = NATURAL_SHEET_PALETTE[i] as (typeof NATURAL_SHEET_PALETTE)[number];
      const btn = document.createElement("button");
      btn.style.cssText = `
        width: 44px; height: 44px; border: 2px solid #555; border-radius: 4px;
        background: #444; color: #fff; font: bold 9px monospace;
        cursor: pointer; text-shadow: 0 1px 2px rgba(0,0,0,0.8);
        display: flex; align-items: center; justify-content: center;
      `;
      btn.textContent = entry.label;
      btn.title = `${entry.sheetKey}: ${entry.label}`;
      const idx = i;
      btn.addEventListener("click", () => {
        this.selectedTerrain = entry.storedValue;
        this.selectedNaturalIndex = idx;
        this.updateTerrainSelection();
      });
      this.naturalPaletteButtons.push(btn);
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
    // Non-natural tabs don't expose brush/paint controls — reset to defaults
    if (tab !== "natural") {
      this.setBrushMode("tile");
      this.setPaintMode("positive");
    }
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
    this.elevationRow.style.display = this.editorTab === "elevation" ? "flex" : "none";
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
    } else if (this.brushMode === "corner") {
      this.setBrushMode("cross");
    } else if (this.brushMode === "cross") {
      this.setBrushMode("x");
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
    const showSize = this.brushMode === "subgrid" || this.brushMode === "corner";
    const showBridge = true;
    const sizeD = showSize ? "" : "none";
    this.sizeLabel.style.display = sizeD;
    this.brushSizeButton.style.display = sizeD;
    this.subgridSeparator.style.display = showBridge ? "" : "none";
    this.bridgeLabel.style.display = showBridge ? "" : "none";
    this.bridgeButton.style.display = showBridge ? "" : "none";
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
    const label = this.subgridShape === 1 ? "1x1" : `${this.subgridShape}x${this.subgridShape}`;
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

  consumeClearRequest(): number | null {
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
    // Natural palette buttons: highlight by palette index (handles duplicate stored values)
    for (let i = 0; i < this.naturalPaletteButtons.length; i++) {
      const btn = this.naturalPaletteButtons[i];
      if (!btn) continue;
      const active = i === this.selectedNaturalIndex;
      btn.style.borderColor = active ? "#fff" : "#555";
      btn.style.boxShadow = active ? "0 0 6px rgba(255,255,255,0.5)" : "none";
    }
    // Structure buttons: highlight by terrainId (only when no natural selection)
    for (const { btn, entry } of this.terrainButtons) {
      const active = entry.terrainId === this.selectedTerrain && this.selectedNaturalIndex === -1;
      btn.style.borderColor = active ? "#fff" : "#555";
      btn.style.boxShadow = active ? "0 0 6px rgba(255,255,255,0.5)" : "none";
    }
    for (const btn of this.autoButtons) {
      btn.style.borderColor = isAuto ? "#fff" : "#555";
      btn.style.boxShadow = isAuto ? "0 0 6px rgba(255,255,255,0.5)" : "none";
    }
    for (const wrapper of this.terrainWrappers) {
      wrapper.style.display = "contents";
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

  private updateElevationSelection(): void {
    for (let i = 0; i < this.elevationHeightButtons.length; i++) {
      const btn = this.elevationHeightButtons[i];
      if (!btn) continue;
      const active = i === this.selectedElevation;
      btn.style.borderColor = active ? "#fff" : "#555";
      btn.style.boxShadow = active ? "0 0 6px rgba(255,255,255,0.5)" : "none";
    }
    for (let i = 0; i < this.elevationGridButtons.length; i++) {
      const btn = this.elevationGridButtons[i];
      if (!btn) continue;
      const active = ELEVATION_GRID_SIZES[i] === this.elevationGridSize;
      btn.style.borderColor = active ? "#fff" : "#555";
      btn.style.boxShadow = active ? "0 0 6px rgba(255,255,255,0.5)" : "none";
    }
  }

  /** Render actual tile/sprite graphics into preview buttons once assets are loaded. */
  setAssets(
    sheets: Map<string, Spritesheet>,
    blendSheets: Spritesheet[],
    blendGraph: BlendGraph,
  ): void {
    // Natural sheet buttons: draw primary fill from blend sheet
    for (let i = 0; i < NATURAL_SHEET_PALETTE.length; i++) {
      const btn = this.naturalPaletteButtons[i];
      const entry = NATURAL_SHEET_PALETTE[i];
      if (!btn || !entry) continue;
      const sheetIdx = blendGraph.allSheets.findIndex((s) => s.sheetKey === entry.sheetKey);
      if (sheetIdx >= 0) {
        const sheet = blendSheets[sheetIdx];
        if (sheet) {
          // (5,2) = mask 55 (N+W+E+NW+NE): top ~2/3 primary, bottom 1/3 secondary
          this.renderPreviewCanvas(btn, sheet, 5, 2, 44, 44);
        }
      }
    }

    // Structure buttons: draw base fill tile
    for (const { btn, entry } of this.terrainButtons) {
      const fill = blendGraph.getBaseFill(entry.terrainId);
      const sheet = fill ? blendSheets[fill.sheetIndex] : undefined;
      if (fill && sheet) {
        this.renderPreviewCanvas(btn, sheet, fill.col, fill.row, 44, 44);
      }
    }

    // Entity buttons: draw first sprite frame
    for (let i = 0; i < ENTITY_PALETTE.length; i++) {
      const btn = this.entityButtons[i];
      const entry = ENTITY_PALETTE[i];
      if (!btn || !entry) continue;
      const sheet = sheets.get(entry.type);
      if (sheet) {
        this.renderPreviewCanvas(btn, sheet, 0, 0, 64, 44);
      }
    }

    // Road buttons: draw road tile from me-complete
    const roadSheet = sheets.get("me21");
    if (roadSheet) {
      for (const { btn, entry } of this.roadButtons) {
        // Road base fills: Asphalt=(1,0), Sidewalk/Lines use colored fallback
        if (entry.roadType === RoadType.Asphalt) {
          this.renderPreviewCanvas(btn, roadSheet, 1, 0, 44, 44);
        }
      }
    }
  }

  /** Draw a spritesheet tile into a canvas inside a button. */
  private renderPreviewCanvas(
    btn: HTMLButtonElement,
    sheet: Spritesheet,
    col: number,
    row: number,
    btnW: number,
    btnH: number,
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

    const region = sheet.getRegion(col, row);
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
}
