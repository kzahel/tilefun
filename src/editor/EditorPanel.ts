import type { Spritesheet } from "../assets/Spritesheet.js";
import type { BlendGraph } from "../autotile/BlendGraph.js";
import { MAX_ELEVATION } from "../config/constants.js";
import { getPropSheetInfo, PROP_PALETTE } from "../entities/PropFactories.js";
import { RoadType } from "../road/RoadType.js";
import type { EditorModel } from "./EditorModel.js";
import {
  ALL_TABS,
  type EditorTab,
  ELEVATION_COLORS,
  ELEVATION_GRID_SIZES,
  ENTITY_PALETTE,
  NATURAL_SHEET_PALETTE,
  type PaletteEntry,
  ROAD_PALETTE,
  type RoadPaletteEntry,
  STRUCTURE_PALETTE,
  TERRAIN_TABS,
} from "./EditorPalettes.js";
import type { BrushMode, PaintMode } from "./EditorTypes.js";

export type { EditorTab };

const PANEL_STYLE = `
  position: fixed; bottom: 0; left: 0; right: 0;
  background: rgba(0,0,0,0.8); color: #fff;
  font: 13px monospace; padding: 0;
  border-radius: 6px 6px 0 0; z-index: 100;
  display: none; user-select: none;
  flex-direction: column;
`;

const BTN_STYLE = `
  height: 44px; border: 2px solid #888; border-radius: 4px;
  background: #444; color: #fff; font: bold 10px monospace;
  cursor: pointer; padding: 0 10px;
`;

const TAB_STYLE = `
  padding: 10px 14px; border: none; border-radius: 6px 6px 0 0;
  font: bold 12px monospace; cursor: pointer; min-height: 40px;
  display: flex; align-items: center; gap: 5px;
`;

const ROW_STYLE =
  "display: flex; flex-wrap: wrap; gap: 4px; align-items: center; padding: 8px 12px;";

export class EditorPanel {
  readonly el: HTMLDivElement;
  private readonly container: HTMLDivElement;
  private readonly model: EditorModel;
  private readonly collapseArrow: HTMLButtonElement;
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
  private readonly autoButtons: HTMLButtonElement[] = [];
  private readonly terrainWrappers: HTMLDivElement[] = [];
  private readonly entityButtons: HTMLButtonElement[] = [];
  private readonly propsRow: HTMLDivElement;
  private readonly propButtons: HTMLButtonElement[] = [];
  private readonly deleteButtons: HTMLButtonElement[] = [];
  private readonly brushModeButtons: Map<BrushMode, HTMLButtonElement> = new Map();
  private readonly bridgeButton: HTMLButtonElement;
  private readonly subgridSeparator: HTMLDivElement;
  private readonly sizeLabel: HTMLSpanElement;
  private readonly bridgeLabel: HTMLSpanElement;
  private readonly brushSizeButton: HTMLButtonElement;
  private readonly paintModeButtons: Map<PaintMode, HTMLButtonElement> = new Map();
  private readonly roadButtons: { btn: HTMLButtonElement; entry: RoadPaletteEntry }[] = [];

  constructor(model: EditorModel) {
    this.model = model;
    this.container = document.createElement("div");
    this.el = this.container;
    this.container.style.cssText = PANEL_STYLE;
    this.container.style.display = "none";

    // Subscribe to model changes
    model.addListener(() => this.syncFromModel());

    // --- Collapse arrow (above tab bar) ---
    this.collapseArrow = document.createElement("button");
    this.collapseArrow.style.cssText = `
      display: flex; align-items: center; justify-content: center;
      width: 100%; height: 28px; border: none; border-radius: 6px 6px 0 0;
      background: rgba(80,80,80,0.6); color: #ccc; font-size: 22px;
      cursor: pointer; padding: 0; margin: 0; line-height: 1;
      transition: background 0.15s, color 0.15s;
    `;
    this.collapseArrow.textContent = "\u25bc";
    this.collapseArrow.title = "Close editor (Tab)";
    this.collapseArrow.addEventListener("pointerenter", () => {
      this.collapseArrow.style.background = "rgba(120,120,120,0.8)";
      this.collapseArrow.style.color = "#fff";
    });
    this.collapseArrow.addEventListener("pointerleave", () => {
      this.collapseArrow.style.background = "rgba(80,80,80,0.6)";
      this.collapseArrow.style.color = "#ccc";
    });
    this.collapseArrow.addEventListener("click", () => {
      this.model.onCollapse?.();
    });
    this.container.appendChild(this.collapseArrow);

    // --- Tab bar ---
    const tabBar = document.createElement("div");
    tabBar.style.cssText = "display: flex; flex-wrap: wrap; gap: 3px; padding: 0 8px;";
    for (const tab of ALL_TABS) {
      const btn = document.createElement("button");
      btn.style.cssText = TAB_STYLE;
      const TAB_ICONS: Record<EditorTab, string> = {
        natural: "\ud83c\udf3f",
        road: "\ud83d\udee3\ufe0f",
        structure: "\ud83c\udfd7\ufe0f",
        entities: "\ud83d\udc25",
        props: "\ud83c\udf32",
        elevation: "\u26f0\ufe0f",
      };
      const TAB_LABELS: Record<EditorTab, string> = {
        natural: "Natural",
        road: "Road",
        structure: "Structure",
        entities: "Entities",
        props: "Props",
        elevation: "Elevation",
      };
      const icon = document.createElement("span");
      icon.style.fontSize = "15px";
      icon.textContent = TAB_ICONS[tab];
      btn.appendChild(icon);
      btn.appendChild(document.createTextNode(TAB_LABELS[tab]));
      btn.addEventListener("click", () => this.model.setTab(tab));
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
      btn.addEventListener("click", () => this.model.setBrushMode(mode));
      this.toolRow.appendChild(btn);
      this.brushModeButtons.set(mode, btn);
    }

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
      btn.addEventListener("click", () => this.model.setPaintMode(mode));
      this.toolRow.appendChild(btn);
      this.paintModeButtons.set(mode, btn);
    }
    this.subgridSeparator = this.makeSeparator();
    this.toolRow.appendChild(this.subgridSeparator);
    this.sizeLabel = this.makeLabel("Size");
    this.toolRow.appendChild(this.sizeLabel);

    this.brushSizeButton = document.createElement("button");
    this.brushSizeButton.style.cssText = BTN_STYLE;
    this.brushSizeButton.title = "Subgrid brush shape (S)";
    this.brushSizeButton.addEventListener("click", () => this.model.cycleBrushShape());
    this.toolRow.appendChild(this.brushSizeButton);

    this.bridgeLabel = this.makeLabel("Bridge");
    this.toolRow.appendChild(this.bridgeLabel);
    this.bridgeButton = document.createElement("button");
    this.bridgeButton.style.cssText = BTN_STYLE;
    this.bridgeButton.title = "Bridge depth: auto-insert transitions (B)";
    this.bridgeButton.addEventListener("click", () => this.model.cycleBridgeDepth());
    this.toolRow.appendChild(this.bridgeButton);

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
        this.model.selectedEntityType = entry.type;
        this.model.deleteMode = false;
        this.syncFromModel();
      });
      this.entityButtons.push(btn);
      this.entityRow.appendChild(btn);
    }

    this.entityRow.appendChild(this.makeSeparator());
    this.entityRow.appendChild(this.buildDeleteButton());

    this.container.appendChild(this.entityRow);

    // --- Props row ---
    this.propsRow = document.createElement("div");
    this.propsRow.style.cssText = ROW_STYLE;
    this.propsRow.style.maxWidth = "90vw";
    this.propsRow.style.overflowX = "auto";

    let lastCategory = "";
    for (const entry of PROP_PALETTE) {
      if (entry.category !== lastCategory) {
        if (lastCategory !== "") this.propsRow.appendChild(this.makeSeparator());
        const catLabel = entry.category === "nature" ? "Nature" : "Playground";
        this.propsRow.appendChild(this.makeLabel(catLabel));
        lastCategory = entry.category;
      }
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
        this.model.selectedPropType = entry.type;
        this.model.deleteMode = false;
        this.syncFromModel();
      });
      this.propButtons.push(btn);
      this.propsRow.appendChild(btn);
    }

    this.propsRow.appendChild(this.makeSeparator());

    const browseBtn = document.createElement("button");
    browseBtn.style.cssText = `
      width: 80px; height: 44px; border: 2px solid #8cf; border-radius: 4px;
      background: rgba(100,160,255,0.15); color: #8cf; font: bold 10px monospace;
      cursor: pointer; display: flex; align-items: center; justify-content: center;
    `;
    browseBtn.textContent = "Atlas...";
    browseBtn.title = "Browse 4800+ sprites from Modern Exteriors";
    browseBtn.addEventListener("click", () => this.model.onOpenCatalog?.());
    this.propsRow.appendChild(browseBtn);

    this.propsRow.appendChild(this.makeSeparator());
    this.propsRow.appendChild(this.buildDeleteButton());

    this.container.appendChild(this.propsRow);

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
      const height = h;
      btn.addEventListener("click", () => {
        this.model.selectedElevation = height;
        this.syncFromModel();
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
        this.model.elevationGridSize = size;
        this.syncFromModel();
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

    // Initial sync
    this.syncFromModel();
    document.body.appendChild(this.container);
  }

  /** Synchronize all DOM state from the model. */
  private syncFromModel(): void {
    this.updateTabDisplay();
    this.updateBrushModeButtons();
    this.updatePaintModeButtons();
    this.updateSubgridToolVisibility();
    this.updateBrushSizeButton();
    this.updateBridgeButton();
    this.updateTerrainSelection();
    this.updateRoadSelection();
    this.updateEntitySelection();
    this.updatePropSelection();
    this.updateElevationSelection();
    this.updateDeleteButtons();
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
      this.model.selectedTerrain = null;
      this.model.selectedNaturalIndex = -1;
      this.syncFromModel();
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
        this.model.selectedTerrain = entry.terrainId;
        this.model.selectedNaturalIndex = -1;
        this.syncFromModel();
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
        this.model.requestClear();
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
      this.model.selectedTerrain = null;
      this.model.selectedNaturalIndex = -1;
      this.syncFromModel();
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
        this.model.selectedTerrain = entry.storedValue;
        this.model.selectedNaturalIndex = idx;
        this.syncFromModel();
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
        this.model.requestClear();
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
        this.model.selectedRoadType = entry.roadType;
        this.syncFromModel();
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
        this.model.requestRoadClear();
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

  private buildDeleteButton(): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.style.cssText = `
      height: 44px; border: 2px solid #555; border-radius: 4px;
      background: #444; color: #fff; font: bold 10px monospace;
      cursor: pointer; padding: 0 12px;
    `;
    btn.textContent = "Delete";
    btn.title = "Toggle delete mode (tap to remove)";
    btn.addEventListener("click", () => {
      this.model.deleteMode = !this.model.deleteMode;
      this.syncFromModel();
    });
    this.deleteButtons.push(btn);
    return btn;
  }

  private updateDeleteButtons(): void {
    for (const btn of this.deleteButtons) {
      btn.style.borderColor = this.model.deleteMode ? "#f55" : "#555";
      btn.style.background = this.model.deleteMode ? "#633" : "#444";
    }
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

  private updateTabDisplay(): void {
    const active = "background: #555; color: #fff;";
    const inactive = "background: #222; color: #888;";
    for (const [tab, btn] of this.tabButtons) {
      btn.style.cssText = TAB_STYLE + (tab === this.model.editorTab ? active : inactive);
    }
    // Road tab uses tile-only painting — hide tool row (brush modes, subgrid tools)
    const isTerrainTab = TERRAIN_TABS.includes(this.model.editorTab);
    const isRoad = this.model.editorTab === "road";
    this.toolRow.style.display = isTerrainTab && !isRoad ? "flex" : "none";
    this.naturalRow.style.display = this.model.editorTab === "natural" ? "flex" : "none";
    this.roadRow.style.display = isRoad ? "flex" : "none";
    this.structureRow.style.display = this.model.editorTab === "structure" ? "flex" : "none";
    this.entityRow.style.display = this.model.editorTab === "entities" ? "flex" : "none";
    this.propsRow.style.display = this.model.editorTab === "props" ? "flex" : "none";
    this.elevationRow.style.display = this.model.editorTab === "elevation" ? "flex" : "none";
  }

  private updateBrushModeButtons(): void {
    for (const [mode, btn] of this.brushModeButtons) {
      const isActive = mode === this.model.brushMode;
      btn.style.borderColor = isActive ? "#fff" : "#555";
      btn.style.background = isActive ? "#555" : "#444";
    }
  }

  private updateSubgridToolVisibility(): void {
    const showSize = this.model.brushMode === "subgrid" || this.model.brushMode === "corner";
    const showBridge = true;
    const sizeD = showSize ? "" : "none";
    this.sizeLabel.style.display = sizeD;
    this.brushSizeButton.style.display = sizeD;
    this.subgridSeparator.style.display = showBridge ? "" : "none";
    this.bridgeLabel.style.display = showBridge ? "" : "none";
    this.bridgeButton.style.display = showBridge ? "" : "none";
  }

  private updatePaintModeButtons(): void {
    const colors: Record<PaintMode, string> = {
      positive: "#4a4",
      unpaint: "#f55",
    };
    const effective = this.model.effectivePaintMode;
    for (const [mode, btn] of this.paintModeButtons) {
      const isActive = mode === effective;
      btn.style.borderColor = isActive ? colors[mode] : "#555";
      btn.style.background = isActive ? "#555" : "#444";
    }
  }

  private updateBrushSizeButton(): void {
    const shape = this.model.subgridShape;
    const label = shape === 1 ? "1x1" : `${shape}x${shape}`;
    this.brushSizeButton.textContent = label;
    this.brushSizeButton.style.borderColor = shape !== 1 ? "#a4f" : "#888";
  }

  private updateBridgeButton(): void {
    const depth = this.model.bridgeDepth;
    const label = depth === 0 ? "B:Off" : `B:${depth}`;
    this.bridgeButton.textContent = label;
    this.bridgeButton.style.borderColor = depth > 0 ? "#4a9" : "#888";
  }

  private updateTerrainSelection(): void {
    const isAuto = this.model.selectedTerrain === null;
    // Natural palette buttons: highlight by palette index (handles duplicate stored values)
    for (let i = 0; i < this.naturalPaletteButtons.length; i++) {
      const btn = this.naturalPaletteButtons[i];
      if (!btn) continue;
      const isActive = i === this.model.selectedNaturalIndex;
      btn.style.borderColor = isActive ? "#fff" : "#555";
      btn.style.boxShadow = isActive ? "0 0 6px rgba(255,255,255,0.5)" : "none";
    }
    // Structure buttons: highlight by terrainId (only when no natural selection)
    for (const { btn, entry } of this.terrainButtons) {
      const isActive =
        entry.terrainId === this.model.selectedTerrain && this.model.selectedNaturalIndex === -1;
      btn.style.borderColor = isActive ? "#fff" : "#555";
      btn.style.boxShadow = isActive ? "0 0 6px rgba(255,255,255,0.5)" : "none";
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
      btn.style.borderColor = entry.roadType === this.model.selectedRoadType ? "#fff" : "#555";
      btn.style.boxShadow =
        entry.roadType === this.model.selectedRoadType ? "0 0 6px rgba(255,255,255,0.5)" : "none";
    }
  }

  private updateEntitySelection(): void {
    for (let i = 0; i < ENTITY_PALETTE.length; i++) {
      const btn = this.entityButtons[i];
      const entry = ENTITY_PALETTE[i];
      if (btn && entry) {
        btn.style.borderColor = entry.type === this.model.selectedEntityType ? "#fff" : "#555";
        btn.style.boxShadow =
          entry.type === this.model.selectedEntityType ? "0 0 6px rgba(255,255,255,0.5)" : "none";
      }
    }
  }

  private updatePropSelection(): void {
    for (let i = 0; i < PROP_PALETTE.length; i++) {
      const btn = this.propButtons[i];
      const entry = PROP_PALETTE[i];
      if (btn && entry) {
        btn.style.borderColor = entry.type === this.model.selectedPropType ? "#fff" : "#555";
        btn.style.boxShadow =
          entry.type === this.model.selectedPropType ? "0 0 6px rgba(255,255,255,0.5)" : "none";
      }
    }
  }

  private updateElevationSelection(): void {
    for (let i = 0; i < this.elevationHeightButtons.length; i++) {
      const btn = this.elevationHeightButtons[i];
      if (!btn) continue;
      const isActive = i === this.model.selectedElevation;
      btn.style.borderColor = isActive ? "#fff" : "#555";
      btn.style.boxShadow = isActive ? "0 0 6px rgba(255,255,255,0.5)" : "none";
    }
    for (let i = 0; i < this.elevationGridButtons.length; i++) {
      const btn = this.elevationGridButtons[i];
      if (!btn) continue;
      const isActive = ELEVATION_GRID_SIZES[i] === this.model.elevationGridSize;
      btn.style.borderColor = isActive ? "#fff" : "#555";
      btn.style.boxShadow = isActive ? "0 0 6px rgba(255,255,255,0.5)" : "none";
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

    // Prop buttons: draw sprite preview from the prop's own sheet
    for (let i = 0; i < PROP_PALETTE.length; i++) {
      const btn = this.propButtons[i];
      const entry = PROP_PALETTE[i];
      if (!btn || !entry) continue;
      const info = getPropSheetInfo(entry.type);
      if (!info) continue;
      const sheet = sheets.get(info.sheetKey);
      if (sheet) {
        this.renderPreviewCanvas(btn, sheet, info.col, info.row, 64, 44);
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
