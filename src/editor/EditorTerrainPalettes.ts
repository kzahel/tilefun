import type { Spritesheet } from "../assets/Spritesheet.js";
import type { BlendGraph } from "../autotile/BlendGraph.js";
import { RoadType } from "../road/RoadType.js";
import {
  NATURAL_SHEET_PALETTE,
  type PaletteEntry,
  ROAD_PALETTE,
  type RoadPaletteEntry,
  STRUCTURE_PALETTE,
} from "./EditorPalettes.js";
import {
  type EditorSection,
  type EditorSectionHost,
  highlight,
  makeConfirmClearButton,
  makeRow,
  makeSeparator,
  paletteButtonStyle,
  renderPreviewCanvas,
} from "./EditorPanelWidgets.js";

/** Natural, road and structure terrain palettes (rows in that order). */
export class EditorTerrainPalettes implements EditorSection {
  readonly rows: readonly HTMLElement[];
  private readonly naturalRow: HTMLDivElement;
  private readonly roadRow: HTMLDivElement;
  private readonly structureRow: HTMLDivElement;
  /** Structure terrain buttons with their entries, for selection highlighting. */
  private readonly terrainButtons: { btn: HTMLButtonElement; entry: PaletteEntry }[] = [];
  private readonly naturalPaletteButtons: HTMLButtonElement[] = [];
  private readonly autoButtons: HTMLButtonElement[] = [];
  private readonly terrainWrappers: HTMLDivElement[] = [];
  private readonly roadButtons: { btn: HTMLButtonElement; entry: RoadPaletteEntry }[] = [];

  constructor(private readonly host: EditorSectionHost) {
    this.naturalRow = this.buildNaturalRow();
    this.roadRow = this.buildRoadRow();
    this.structureRow = this.buildStructureRow(STRUCTURE_PALETTE);
    this.rows = [this.naturalRow, this.roadRow, this.structureRow];
  }

  sync(): void {
    const tab = this.host.model.editorTab;
    this.naturalRow.style.display = tab === "natural" ? "flex" : "none";
    this.roadRow.style.display = tab === "road" ? "flex" : "none";
    this.structureRow.style.display = tab === "structure" ? "flex" : "none";
    this.updateTerrainSelection();
    this.updateRoadSelection();
  }

  /** Natural sheets draw their primary fill; structure terrains draw their base fill tile. */
  setBlendAssets(blendSheets: Spritesheet[], blendGraph: BlendGraph): void {
    for (let i = 0; i < NATURAL_SHEET_PALETTE.length; i++) {
      const btn = this.naturalPaletteButtons[i];
      const entry = NATURAL_SHEET_PALETTE[i];
      if (!btn || !entry) continue;
      const sheetIdx = blendGraph.allSheets.findIndex((s) => s.sheetKey === entry.sheetKey);
      const sheet = sheetIdx >= 0 ? blendSheets[sheetIdx] : undefined;
      // (5,2) = mask 55 (N+W+E+NW+NE): top ~2/3 primary, bottom 1/3 secondary
      if (sheet) renderPreviewCanvas(btn, sheet, 5, 2, 44, 44);
    }

    for (const { btn, entry } of this.terrainButtons) {
      const fill = blendGraph.getBaseFill(entry.terrainId);
      const sheet = fill ? blendSheets[fill.sheetIndex] : undefined;
      if (fill && sheet) {
        renderPreviewCanvas(btn, sheet, fill.col, fill.row, 44, 44);
      }
    }
  }

  /** Road buttons: draw road tile from me-complete. */
  setRoadAssets(sheets: Map<string, Spritesheet>): void {
    const roadSheet = sheets.get("me21");
    if (!roadSheet) return;
    for (const { btn, entry } of this.roadButtons) {
      // Road base fills: Asphalt=(1,0), Sidewalk/Lines use colored fallback
      if (entry.roadType === RoadType.Asphalt) {
        renderPreviewCanvas(btn, roadSheet, 1, 0, 44, 44);
      }
    }
  }

  /** Auto (smudge) button, always visible, starting a terrain row. */
  private buildAutoButton(row: HTMLDivElement): void {
    const autoBtn = document.createElement("button");
    autoBtn.style.cssText = paletteButtonStyle("#556", "#cdf");
    autoBtn.textContent = "Auto";
    autoBtn.title = "Smudge: L-click grows, R-click shrinks";
    autoBtn.addEventListener("click", () => {
      this.host.model.selectedTerrain = null;
      this.host.model.selectedNaturalIndex = -1;
      this.host.sync();
    });
    row.appendChild(autoBtn);
    this.autoButtons.push(autoBtn);
  }

  /** Wrapper for terrain-specific elements after the Auto button. */
  private buildWrapper(): HTMLDivElement {
    const wrapper = document.createElement("div");
    wrapper.style.display = "contents";
    this.terrainWrappers.push(wrapper);
    return wrapper;
  }

  private appendTerrainClear(row: HTMLDivElement, wrapper: HTMLDivElement): void {
    wrapper.appendChild(makeSeparator());
    wrapper.appendChild(
      makeConfirmClearButton("Fill all chunks with selected terrain", () =>
        this.host.model.requestClear(),
      ),
    );
    row.appendChild(wrapper);
  }

  private buildStructureRow(palette: PaletteEntry[]): HTMLDivElement {
    const row = makeRow();
    this.buildAutoButton(row);
    const wrapper = this.buildWrapper();
    for (const entry of palette) {
      const btn = document.createElement("button");
      btn.style.cssText = paletteButtonStyle(entry.color);
      btn.textContent = entry.label;
      btn.title = entry.label;
      btn.addEventListener("click", () => {
        this.host.model.selectedTerrain = entry.terrainId;
        this.host.model.selectedNaturalIndex = -1;
        this.host.sync();
      });
      this.terrainButtons.push({ btn, entry });
      wrapper.appendChild(btn);
    }
    this.appendTerrainClear(row, wrapper);
    return row;
  }

  private buildNaturalRow(): HTMLDivElement {
    const row = makeRow();
    this.buildAutoButton(row);
    const wrapper = this.buildWrapper();
    for (const [idx, entry] of NATURAL_SHEET_PALETTE.entries()) {
      const btn = document.createElement("button");
      btn.style.cssText = paletteButtonStyle("#444");
      btn.textContent = entry.label;
      btn.title = `${entry.sheetKey}: ${entry.label}`;
      btn.addEventListener("click", () => {
        this.host.model.selectedTerrain = entry.storedValue;
        this.host.model.selectedNaturalIndex = idx;
        this.host.sync();
      });
      this.naturalPaletteButtons.push(btn);
      wrapper.appendChild(btn);
    }
    this.appendTerrainClear(row, wrapper);
    return row;
  }

  private buildRoadRow(): HTMLDivElement {
    const row = makeRow();
    for (const entry of ROAD_PALETTE) {
      const btn = document.createElement("button");
      btn.style.cssText = paletteButtonStyle(entry.color);
      btn.textContent = entry.label;
      btn.title = entry.label;
      btn.addEventListener("click", () => {
        this.host.model.selectedRoadType = entry.roadType;
        this.host.sync();
      });
      this.roadButtons.push({ btn, entry });
      row.appendChild(btn);
    }
    row.appendChild(makeSeparator());
    row.appendChild(
      makeConfirmClearButton("Clear all roads", () => this.host.model.requestRoadClear()),
    );
    return row;
  }

  private updateTerrainSelection(): void {
    const model = this.host.model;
    const isAuto = model.selectedTerrain === null;
    // Natural palette buttons: highlight by palette index (handles duplicate stored values)
    for (const [i, btn] of this.naturalPaletteButtons.entries())
      highlight(btn, i === model.selectedNaturalIndex);
    // Structure buttons: highlight by terrainId (only when no natural selection)
    for (const { btn, entry } of this.terrainButtons)
      highlight(
        btn,
        entry.terrainId === model.selectedTerrain && model.selectedNaturalIndex === -1,
      );
    for (const btn of this.autoButtons) highlight(btn, isAuto);
    for (const wrapper of this.terrainWrappers) wrapper.style.display = "contents";
  }

  private updateRoadSelection(): void {
    for (const { btn, entry } of this.roadButtons)
      highlight(btn, entry.roadType === this.host.model.selectedRoadType);
  }
}
