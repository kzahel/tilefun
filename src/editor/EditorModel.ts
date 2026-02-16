import { TerrainId } from "../autotile/TerrainId.js";
import { RoadType } from "../road/RoadType.js";
import { ALL_TABS, type EditorTab, TERRAIN_TABS } from "./EditorPalettes.js";
import type { BrushMode, PaintMode, SubgridShape } from "./EditorTypes.js";

export type EditorModelListener = () => void;

export class EditorModel {
  // --- Selection state ---
  editorTab: EditorTab = "natural";
  selectedTerrain: number | null = TerrainId.Grass;
  selectedNaturalIndex = 8;
  selectedRoadType: RoadType = RoadType.Asphalt;
  selectedEntityType = "chicken";
  selectedPropType = "prop-flower-red";
  deleteMode = false;
  selectedElevation = 1;
  elevationGridSize = 1;

  // --- Brush/paint state ---
  brushMode: BrushMode = "tile";
  paintMode: PaintMode = "positive";
  subgridShape: SubgridShape = 1;
  bridgeDepth = 0;

  // --- Temporary overrides ---
  private _temporaryUnpaint = false;

  // --- Pending commands (consumed by game loop) ---
  private _pendingClear: number | null = null;
  private _pendingRoadClear = false;

  // --- Change listeners ---
  private listeners: EditorModelListener[] = [];

  // --- Callbacks ---
  onCollapse: (() => void) | null = null;
  onOpenCatalog: (() => void) | null = null;

  // --- Computed properties ---

  /** The paint mode actually in effect (accounts for right-click temporary unpaint). */
  get effectivePaintMode(): PaintMode {
    return this._temporaryUnpaint ? "unpaint" : this.paintMode;
  }

  /** Numeric brush size for backward compat. Cross/X return 1 (handled separately). */
  get brushSize(): 1 | 2 | 3 {
    return typeof this.subgridShape === "number" ? this.subgridShape : 1;
  }

  // --- Mutation methods ---

  setTab(tab: EditorTab): void {
    this.editorTab = tab;
    this.deleteMode = false;
    // Non-natural tabs don't expose brush/paint controls — reset to defaults
    if (tab !== "natural") {
      this.brushMode = "tile";
      this.paintMode = "positive";
    }
    this.notify();
  }

  toggleTab(): void {
    const idx = ALL_TABS.indexOf(this.editorTab);
    this.setTab(ALL_TABS[(idx + 1) % ALL_TABS.length] ?? "natural");
  }

  setBrushMode(mode: BrushMode): void {
    this.brushMode = mode;
    this.notify();
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

  setPaintMode(mode: PaintMode): void {
    this.paintMode = mode;
    this.notify();
  }

  /** Set temporary unpaint override (while right-click held). */
  setTemporaryUnpaint(active: boolean): void {
    if (this._temporaryUnpaint !== active) {
      this._temporaryUnpaint = active;
      this.notify();
    }
  }

  cycleBrushShape(): void {
    if (this.subgridShape === 1) this.subgridShape = 2;
    else if (this.subgridShape === 2) this.subgridShape = 3;
    else this.subgridShape = 1;
    this.notify();
  }

  cycleBridgeDepth(): void {
    this.bridgeDepth = (this.bridgeDepth + 1) % 4; // 0, 1, 2, 3
    this.notify();
  }

  requestClear(): void {
    this._pendingClear = this.selectedTerrain;
  }

  requestRoadClear(): void {
    this._pendingRoadClear = true;
  }

  consumeClearRequest(): number | null {
    const c = this._pendingClear;
    this._pendingClear = null;
    return c;
  }

  consumeRoadClearRequest(): boolean {
    const c = this._pendingRoadClear;
    this._pendingRoadClear = false;
    return c;
  }

  /** Whether the current tab uses terrain painting (shared tool row). */
  get isTerrainTab(): boolean {
    return TERRAIN_TABS.includes(this.editorTab);
  }

  // --- Listener management ---

  addListener(fn: EditorModelListener): () => void {
    this.listeners.push(fn);
    return () => {
      const idx = this.listeners.indexOf(fn);
      if (idx >= 0) this.listeners.splice(idx, 1);
    };
  }

  private notify(): void {
    for (const fn of this.listeners) {
      fn();
    }
  }
}
