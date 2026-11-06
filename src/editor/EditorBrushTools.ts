import { TERRAIN_TABS } from "./EditorPalettes.js";
import {
  BTN_STYLE,
  type EditorSection,
  type EditorSectionHost,
  makeLabel,
  makeRow,
  makeSeparator,
} from "./EditorPanelWidgets.js";
import type { BrushMode, PaintMode } from "./EditorTypes.js";

const BRUSH_MODES: { mode: BrushMode; label: string; key: string }[] = [
  { mode: "tile", label: "■", key: "M" },
  { mode: "subgrid", label: "⊞", key: "M" },
  { mode: "corner", label: "◇", key: "M" },
  { mode: "cross", label: "✚", key: "M" },
  { mode: "x", label: "✖", key: "M" },
];

const PAINT_MODES: { mode: PaintMode; label: string; key: string }[] = [
  { mode: "positive", label: "+", key: "Z" },
  { mode: "unpaint", label: "×", key: "C" },
];

const PAINT_MODE_COLORS: Record<PaintMode, string> = {
  positive: "#4a4",
  unpaint: "#f55",
};

/** Shared brush row for painted terrain tabs: brush shape, paint/unpaint, subgrid size, bridge depth. */
export class EditorBrushTools implements EditorSection {
  readonly rows: readonly HTMLElement[];
  private readonly toolRow = makeRow();
  private readonly brushModeButtons = new Map<BrushMode, HTMLButtonElement>();
  private readonly paintModeButtons = new Map<PaintMode, HTMLButtonElement>();
  private readonly subgridSeparator: HTMLDivElement;
  private readonly sizeLabel: HTMLSpanElement;
  private readonly brushSizeButton: HTMLButtonElement;
  private readonly bridgeLabel: HTMLSpanElement;
  private readonly bridgeButton: HTMLButtonElement;

  constructor(private readonly host: EditorSectionHost) {
    const model = host.model;
    this.toolRow.appendChild(makeLabel("Brush"));
    for (const { mode, label, key } of BRUSH_MODES) {
      const btn = document.createElement("button");
      btn.style.cssText = BTN_STYLE;
      btn.style.fontSize = "16px";
      btn.textContent = label;
      btn.title = `${mode} brush (${key})`;
      btn.addEventListener("click", () => model.setBrushMode(mode));
      this.toolRow.appendChild(btn);
      this.brushModeButtons.set(mode, btn);
    }

    // Paint mode buttons: Positive / Unpaint
    this.toolRow.appendChild(makeSeparator());
    this.toolRow.appendChild(makeLabel("Paint"));
    for (const { mode, label, key } of PAINT_MODES) {
      const btn = document.createElement("button");
      btn.style.cssText = BTN_STYLE;
      btn.textContent = label;
      btn.title = `${mode} mode (${key})`;
      btn.addEventListener("click", () => model.setPaintMode(mode));
      this.toolRow.appendChild(btn);
      this.paintModeButtons.set(mode, btn);
    }
    this.subgridSeparator = makeSeparator();
    this.toolRow.appendChild(this.subgridSeparator);
    this.sizeLabel = makeLabel("Size");
    this.toolRow.appendChild(this.sizeLabel);

    this.brushSizeButton = document.createElement("button");
    this.brushSizeButton.style.cssText = BTN_STYLE;
    this.brushSizeButton.title = "Subgrid brush shape (S)";
    this.brushSizeButton.addEventListener("click", () => model.cycleBrushShape());
    this.toolRow.appendChild(this.brushSizeButton);

    this.bridgeLabel = makeLabel("Bridge");
    this.toolRow.appendChild(this.bridgeLabel);
    this.bridgeButton = document.createElement("button");
    this.bridgeButton.style.cssText = BTN_STYLE;
    this.bridgeButton.title = "Bridge depth: auto-insert transitions (B)";
    this.bridgeButton.addEventListener("click", () => model.cycleBridgeDepth());
    this.toolRow.appendChild(this.bridgeButton);
    this.rows = [this.toolRow];
  }

  sync(): void {
    const model = this.host.model;
    // Road tab uses tile-only painting — hide tool row (brush modes, subgrid tools)
    const isTerrainTab = TERRAIN_TABS.includes(model.editorTab);
    this.toolRow.style.display = isTerrainTab && model.editorTab !== "road" ? "flex" : "none";
    this.updateBrushModeButtons();
    this.updatePaintModeButtons();
    this.updateSubgridToolVisibility();
    this.updateBrushSizeButton();
    this.updateBridgeButton();
  }

  private updateBrushModeButtons(): void {
    for (const [mode, btn] of this.brushModeButtons) {
      const isActive = mode === this.host.model.brushMode;
      btn.style.borderColor = isActive ? "#fff" : "#555";
      btn.style.background = isActive ? "#555" : "#444";
    }
  }

  private updatePaintModeButtons(): void {
    const effective = this.host.model.effectivePaintMode;
    for (const [mode, btn] of this.paintModeButtons) {
      const isActive = mode === effective;
      btn.style.borderColor = isActive ? PAINT_MODE_COLORS[mode] : "#555";
      btn.style.background = isActive ? "#555" : "#444";
    }
  }

  private updateSubgridToolVisibility(): void {
    const brushMode = this.host.model.brushMode;
    const sizeD = brushMode === "subgrid" || brushMode === "corner" ? "" : "none";
    this.sizeLabel.style.display = sizeD;
    this.brushSizeButton.style.display = sizeD;
    // The bridge control is always shown.
    this.subgridSeparator.style.display = "";
    this.bridgeLabel.style.display = "";
    this.bridgeButton.style.display = "";
  }

  private updateBrushSizeButton(): void {
    const shape = this.host.model.subgridShape;
    const label = shape === 1 ? "1x1" : `${shape}x${shape}`;
    this.brushSizeButton.textContent = label;
    this.brushSizeButton.style.borderColor = shape !== 1 ? "#a4f" : "#888";
  }

  private updateBridgeButton(): void {
    const depth = this.host.model.bridgeDepth;
    const label = depth === 0 ? "B:Off" : `B:${depth}`;
    this.bridgeButton.textContent = label;
    this.bridgeButton.style.borderColor = depth > 0 ? "#4a9" : "#888";
  }
}
