import {
  compareModernInteriorsLayers,
  getModernInteriorsCategories,
  getModernInteriorsDesignLayers,
  getModernInteriorsDesigns,
  getModernInteriorsEntries,
  isModernInteriorsAtlasLoaded,
  type ModernInteriorsAtlasEntry,
  type ModernInteriorsSourceKind,
  type ModernInteriorsVariant,
} from "../assets/ModernInteriorsAtlasIndex.js";
import { ADVANCED_SUITE_EXAMPLES, drawAdvancedSuitePreview } from "../interiors/AdvancedSuite.js";
import {
  APARTMENT_EXAMPLES,
  describeFloorPlan,
  drawApartmentPlan,
  parseFloorPlan,
} from "../interiors/ApartmentFloorPlan.js";
import { drawConnectedRoomGrammarPreview } from "../interiors/ConnectedRoomGrammar.js";
import {
  drawGenericHomeGeometryStudy,
  drawGenericHomeLayerStudy,
  drawGenericHomeVariantPreview,
} from "../interiors/GenericHomeGeometry.js";
import { drawRoomGrammarPreview } from "../interiors/RoomGrammar.js";

const MAX_VISIBLE_ENTRIES = 720;
const DEFAULT_DESIGN = "generic-home-designs/generic-home-1";

const OVERLAY_STYLE = `
  position: fixed; inset: 0; z-index: 250;
  background: rgba(12, 14, 22, 0.96);
  display: flex; flex-direction: column;
  font-family: monospace; color: #fff;
  overflow: hidden;
`;

const HEADER_STYLE = `
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px; border-bottom: 1px solid #364052;
  flex-shrink: 0; min-width: 0;
`;

const BODY_STYLE = `
  display: grid; grid-template-columns: minmax(360px, 520px) minmax(0, 1fr);
  min-height: 0; flex: 1;
`;

const PREVIEW_STYLE = `
  border-right: 1px solid #364052; padding: 12px;
  display: flex; flex-direction: column; gap: 10px;
  min-width: 0; overflow: auto;
`;

const BROWSER_STYLE = `
  display: flex; flex-direction: column; min-width: 0; min-height: 0;
`;

const CONTROL_STYLE = `
  font: 13px monospace; padding: 6px 8px;
  background: #1d2533; color: #fff;
  border: 1px solid #536173; border-radius: 4px; outline: none;
`;

const SEARCH_STYLE = `
  ${CONTROL_STYLE}
  flex: 1; min-width: 160px; max-width: 360px;
`;

const CLOSE_BTN_STYLE = `
  font: bold 18px monospace; padding: 4px 10px;
  background: none; color: #b9c3d1; border: 1px solid #536173;
  border-radius: 4px; cursor: pointer; margin-left: auto;
`;

const GRID_STYLE = `
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(112px, 1fr));
  align-content: start;
  gap: 6px; padding: 8px;
  overflow-y: auto; flex: 1; min-height: 0;
`;

const CELL_STYLE = `
  display: grid; grid-template-rows: 72px auto;
  align-items: center; justify-items: center;
  min-height: 104px; min-width: 0;
  padding: 6px; border: 1px solid #3f4a5c;
  border-radius: 4px; cursor: pointer;
  background: rgba(255,255,255,0.035);
`;

const LABEL_STYLE = `
  font: 9px monospace; color: #b5bfcb; text-align: center;
  overflow: hidden; text-overflow: ellipsis;
  white-space: nowrap; max-width: 96px; margin-top: 4px;
`;

const DETAIL_STYLE = `
  border-top: 1px solid #364052; padding: 8px 10px;
  color: #b5bfcb; font: 11px monospace; min-height: 46px;
  overflow: hidden;
`;

const CANVAS_STYLE = `
  image-rendering: pixelated;
  background-color: #151923;
  border: 1px solid #536173;
`;

const SOURCE_KIND_OPTIONS: { value: "" | ModernInteriorsSourceKind; label: string }[] = [
  { value: "", label: "All sources" },
  { value: "home_design_layer", label: "Home designs" },
  { value: "room_builder_tile", label: "Builder tiles" },
  { value: "room_builder_sheet", label: "Builder sheets" },
  { value: "single", label: "Singles" },
];

const VARIANT_OPTIONS: { value: "" | ModernInteriorsVariant; label: string }[] = [
  { value: "", label: "All variants" },
  { value: "normal", label: "Normal" },
  { value: "shadowless", label: "Shadowless" },
  { value: "black-shadow", label: "Black shadow" },
];

function formatSlug(input: string): string {
  return input.replace(/[-_/]+/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function displayName(entry: ModernInteriorsAtlasEntry): string {
  const parts = entry.key.split("/");
  return parts.at(-1) ?? entry.key;
}

function drawChecker(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const size = 8;
  for (let y = 0; y < height; y += size) {
    for (let x = 0; x < width; x += size) {
      ctx.fillStyle = (x / size + y / size) % 2 === 0 ? "#202838" : "#151b28";
      ctx.fillRect(x, y, size, size);
    }
  }
}

function naturalSize(entry: ModernInteriorsAtlasEntry): { width: number; height: number } {
  return { width: entry.rect[2], height: entry.rect[3] };
}

export interface InteriorCatalogRouteState {
  search?: string;
  sourceKind?: "" | ModernInteriorsSourceKind;
  category?: string;
  variant?: "" | ModernInteriorsVariant;
  design?: string;
}

export class InteriorCatalog {
  private overlay: HTMLDivElement;
  private searchInput: HTMLInputElement;
  private sourceSelect: HTMLSelectElement;
  private categorySelect: HTMLSelectElement;
  private variantSelect: HTMLSelectElement;
  private designSelect: HTMLSelectElement;
  private countLabel: HTMLSpanElement;
  private grid: HTMLDivElement;
  private detail: HTMLDivElement;
  private previewPanel: HTMLDivElement;
  private layerControls: HTMLDivElement;
  private stackCanvas: HTMLCanvasElement;
  private sourcePreviewCanvas: HTMLCanvasElement;
  private generatedRoomCanvas: HTMLCanvasElement;
  private geometryStudyCanvas: HTMLCanvasElement;
  private layerStudyCanvas: HTMLCanvasElement;
  private connectedRoomCanvas: HTMLCanvasElement;
  private advancedSuiteCanvases: HTMLCanvasElement[] = [];
  private geometryVariantCanvas: HTMLCanvasElement;
  private apartmentSelect: HTMLSelectElement;
  private apartmentSketch: HTMLTextAreaElement;
  private apartmentStatus: HTMLDivElement;
  private apartmentCanvas: HTMLCanvasElement;
  private entries: ModernInteriorsAtlasEntry[] = [];
  private enabledLayers = new Set<string>();
  private layerControlDesign = "";
  private atlasImage: CanvasImageSource | null = null;
  private pendingRouteState: InteriorCatalogRouteState | null = null;

  onClose: (() => void) | null = null;

  constructor() {
    this.overlay = document.createElement("div");
    this.overlay.style.cssText = OVERLAY_STYLE;
    this.overlay.style.display = "none";
    this.overlay.setAttribute("data-testid", "interior-catalog");

    const header = document.createElement("div");
    header.style.cssText = HEADER_STYLE;

    const title = document.createElement("span");
    title.style.cssText = "font: bold 16px monospace; color: #9bd7ff; margin-right: 8px;";
    title.textContent = "Modern Interiors";
    header.appendChild(title);

    this.searchInput = document.createElement("input");
    this.searchInput.type = "text";
    this.searchInput.placeholder = "Search";
    this.searchInput.style.cssText = SEARCH_STYLE;
    header.appendChild(this.searchInput);

    this.sourceSelect = this.makeSelect(SOURCE_KIND_OPTIONS);
    header.appendChild(this.sourceSelect);

    this.categorySelect = document.createElement("select");
    this.categorySelect.style.cssText = CONTROL_STYLE;
    header.appendChild(this.categorySelect);

    this.variantSelect = this.makeSelect(VARIANT_OPTIONS);
    header.appendChild(this.variantSelect);

    this.countLabel = document.createElement("span");
    this.countLabel.style.cssText = "font: 12px monospace; color: #a8b3c2; white-space: nowrap;";
    header.appendChild(this.countLabel);

    const closeBtn = document.createElement("button");
    closeBtn.style.cssText = CLOSE_BTN_STYLE;
    closeBtn.textContent = "\u00d7";
    closeBtn.title = "Close";
    closeBtn.addEventListener("click", () => this.requestClose());
    header.appendChild(closeBtn);

    this.overlay.appendChild(header);

    const body = document.createElement("div");
    body.style.cssText = BODY_STYLE;

    this.previewPanel = document.createElement("div");
    this.previewPanel.style.cssText = PREVIEW_STYLE;
    body.appendChild(this.previewPanel);

    const browser = document.createElement("div");
    browser.style.cssText = BROWSER_STYLE;
    body.appendChild(browser);

    this.grid = document.createElement("div");
    this.grid.style.cssText = GRID_STYLE;
    this.grid.setAttribute("data-testid", "interior-entry-grid");
    browser.appendChild(this.grid);

    this.detail = document.createElement("div");
    this.detail.style.cssText = DETAIL_STYLE;
    browser.appendChild(this.detail);

    this.overlay.appendChild(body);

    this.designSelect = document.createElement("select");
    this.designSelect.style.cssText = `${CONTROL_STYLE} width: 100%;`;
    this.previewPanel.appendChild(this.designSelect);

    const apartmentHeading = document.createElement("div");
    apartmentHeading.style.cssText = "font: bold 14px monospace; color: #9bd7ff;";
    apartmentHeading.textContent = "Floor plan → tiled apartment";
    this.previewPanel.appendChild(apartmentHeading);
    this.apartmentSelect = this.makeSelect([
      ...APARTMENT_EXAMPLES.map(({ id, name }) => ({ value: id, label: name })),
      { value: "custom", label: "Custom sketch" },
    ]);
    this.apartmentSelect.setAttribute("data-testid", "apartment-example-select");
    this.previewPanel.appendChild(this.apartmentSelect);
    const legend = document.createElement("div");
    legend.style.cssText = "font: 11px monospace; color: #a8b3c2; line-height: 1.5;";
    legend.textContent =
      "Edit the sketch: L living, B bedroom, K kitchen, T bath, H hall, # wall, + door, space outside.";
    this.previewPanel.appendChild(legend);
    this.apartmentSketch = document.createElement("textarea");
    this.apartmentSketch.style.cssText = `${CONTROL_STYLE} width: 100%; min-height: 180px; box-sizing: border-box; white-space: pre; resize: vertical; line-height: 1.1; font-size: 10px;`;
    this.apartmentSketch.spellcheck = false;
    this.apartmentSketch.wrap = "off";
    this.apartmentSketch.value = APARTMENT_EXAMPLES[0].sketch;
    this.apartmentSketch.setAttribute("data-testid", "apartment-sketch");
    this.previewPanel.appendChild(this.apartmentSketch);
    this.apartmentStatus = document.createElement("div");
    this.apartmentStatus.style.cssText = "font: 11px monospace; color: #a8dcb9;";
    this.apartmentStatus.setAttribute("data-testid", "apartment-status");
    this.previewPanel.appendChild(this.apartmentStatus);
    this.apartmentCanvas = document.createElement("canvas");
    this.apartmentCanvas.style.cssText = CANVAS_STYLE;
    this.apartmentCanvas.setAttribute("data-testid", "apartment-preview");
    this.previewPanel.appendChild(this.wrapCanvas("Generated from sketch", this.apartmentCanvas));

    const previewGrid = document.createElement("div");
    previewGrid.style.cssText =
      "display: grid; grid-template-columns: 1fr; gap: 10px; min-width: 0;";

    this.stackCanvas = document.createElement("canvas");
    this.stackCanvas.style.cssText = CANVAS_STYLE;
    this.stackCanvas.setAttribute("data-testid", "interior-prefab-stack");
    previewGrid.appendChild(this.wrapCanvas("Layer stack", this.stackCanvas));

    this.sourcePreviewCanvas = document.createElement("canvas");
    this.sourcePreviewCanvas.style.cssText = CANVAS_STYLE;
    this.sourcePreviewCanvas.setAttribute("data-testid", "interior-prefab-preview");
    previewGrid.appendChild(this.wrapCanvas("Source preview", this.sourcePreviewCanvas));

    this.previewPanel.appendChild(previewGrid);

    this.generatedRoomCanvas = document.createElement("canvas");
    this.generatedRoomCanvas.style.cssText = CANVAS_STYLE;
    this.generatedRoomCanvas.setAttribute("data-testid", "interior-generated-room");
    this.previewPanel.appendChild(
      this.wrapCanvas("Generated room grammar", this.generatedRoomCanvas),
    );

    this.geometryStudyCanvas = document.createElement("canvas");
    this.geometryStudyCanvas.style.cssText = CANVAS_STYLE;
    this.geometryStudyCanvas.setAttribute("data-testid", "interior-geometry-study");
    this.previewPanel.appendChild(
      this.wrapCanvas("Generic Home 1 geometry study", this.geometryStudyCanvas),
    );

    this.layerStudyCanvas = document.createElement("canvas");
    this.layerStudyCanvas.style.cssText = CANVAS_STYLE;
    this.layerStudyCanvas.setAttribute("data-testid", "interior-layer-study");
    this.previewPanel.appendChild(
      this.wrapCanvas("Generic Home 1 layered shell", this.layerStudyCanvas),
    );

    this.connectedRoomCanvas = document.createElement("canvas");
    this.connectedRoomCanvas.style.cssText = CANVAS_STYLE;
    this.connectedRoomCanvas.setAttribute("data-testid", "interior-connected-rooms");
    this.previewPanel.appendChild(
      this.wrapCanvas("Connected rooms from semantic plans", this.connectedRoomCanvas),
    );

    for (const example of ADVANCED_SUITE_EXAMPLES) {
      const canvas = document.createElement("canvas");
      canvas.style.cssText = CANVAS_STYLE;
      canvas.setAttribute("data-testid", `interior-advanced-suite-${example.id}`);
      this.previewPanel.appendChild(this.wrapCanvas(example.name, canvas));
      this.advancedSuiteCanvases.push(canvas);
    }

    this.geometryVariantCanvas = document.createElement("canvas");
    this.geometryVariantCanvas.style.cssText = CANVAS_STYLE;
    this.geometryVariantCanvas.setAttribute("data-testid", "interior-geometry-variant");
    this.previewPanel.appendChild(
      this.wrapCanvas("Generic Home 1 derived variation", this.geometryVariantCanvas),
    );

    this.layerControls = document.createElement("div");
    this.layerControls.style.cssText =
      "display: flex; flex-wrap: wrap; gap: 8px; align-items: center;";
    this.previewPanel.appendChild(this.layerControls);

    let debounceTimer = 0;
    this.searchInput.addEventListener("input", () => {
      clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => this.applyFilter(), 120);
    });
    this.sourceSelect.addEventListener("change", () => this.applyFilter());
    this.categorySelect.addEventListener("change", () => this.applyFilter());
    this.variantSelect.addEventListener("change", () => this.applyFilter());
    this.designSelect.addEventListener("change", () => this.renderPrefabPreview());
    this.apartmentSelect.addEventListener("change", () => {
      const selected = APARTMENT_EXAMPLES.find(({ id }) => id === this.apartmentSelect.value);
      if (selected) this.apartmentSketch.value = selected.sketch;
      this.renderApartmentPreview();
    });
    this.apartmentSketch.addEventListener("input", () => {
      this.apartmentSelect.value = "custom";
      this.renderApartmentPreview();
    });

    for (const evt of [
      "mousedown",
      "mouseup",
      "click",
      "wheel",
      "touchstart",
      "touchmove",
      "touchend",
    ] as const) {
      this.overlay.addEventListener(evt, (e) => e.stopPropagation());
    }
    this.overlay.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Escape") this.requestClose();
    });

    document.body.appendChild(this.overlay);
  }

  setImage(img: CanvasImageSource): void {
    this.atlasImage = img;
    this.renderPrefabPreview();
    this.renderGeneratedRoomPreview();
    this.applyFilter();
  }

  populateAtlas(): void {
    if (!isModernInteriorsAtlasLoaded() || this.entries.length > 0) return;
    this.entries = getModernInteriorsEntries();
    this.populateCategories();
    this.populateDesigns();
    this.applyPendingRouteState();
    this.applyFilter();
    this.renderPrefabPreview();
    this.renderGeneratedRoomPreview();
  }

  setRouteState(state: InteriorCatalogRouteState): void {
    this.pendingRouteState = state;
    this.applyPendingRouteState();
    this.applyFilter();
    this.renderPrefabPreview();
    this.renderGeneratedRoomPreview();
  }

  get visible(): boolean {
    return this.overlay.style.display !== "none";
  }

  show(): void {
    this.overlay.style.display = "flex";
    this.applyFilter();
    this.renderPrefabPreview();
    this.renderGeneratedRoomPreview();
    this.searchInput.focus();
  }

  hide(): void {
    this.overlay.style.display = "none";
  }

  private requestClose(): void {
    if (this.onClose) {
      this.onClose();
    } else {
      this.hide();
    }
  }

  private applyPendingRouteState(): void {
    if (!this.pendingRouteState) return;
    const state = this.pendingRouteState;
    if (state.search !== undefined) this.searchInput.value = state.search;
    if (state.sourceKind !== undefined) this.sourceSelect.value = state.sourceKind;
    if (state.category !== undefined) this.categorySelect.value = state.category;
    if (state.variant !== undefined) this.variantSelect.value = state.variant;
    if (state.design !== undefined) this.designSelect.value = state.design;
  }

  private makeSelect<T extends string>(options: { value: T; label: string }[]): HTMLSelectElement {
    const select = document.createElement("select");
    select.style.cssText = CONTROL_STYLE;
    for (const { value, label } of options) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      select.appendChild(option);
    }
    return select;
  }

  private populateCategories(): void {
    this.categorySelect.replaceChildren();
    const all = document.createElement("option");
    all.value = "";
    all.textContent = "All categories";
    this.categorySelect.appendChild(all);

    for (const category of getModernInteriorsCategories()) {
      const option = document.createElement("option");
      option.value = category;
      option.textContent = formatSlug(category);
      this.categorySelect.appendChild(option);
    }
  }

  private populateDesigns(): void {
    this.designSelect.replaceChildren();
    const designs = getModernInteriorsDesigns();
    for (const design of designs) {
      const option = document.createElement("option");
      option.value = design;
      option.textContent = formatSlug(design);
      this.designSelect.appendChild(option);
    }
    this.designSelect.value = designs.includes(DEFAULT_DESIGN)
      ? DEFAULT_DESIGN
      : (designs[0] ?? "");
  }

  private wrapCanvas(labelText: string, canvas: HTMLCanvasElement): HTMLDivElement {
    const wrapper = document.createElement("div");
    wrapper.style.cssText = "display: flex; flex-direction: column; gap: 4px; min-width: 0;";
    const label = document.createElement("div");
    label.style.cssText = "font: 11px monospace; color: #a8b3c2;";
    label.textContent = labelText;
    wrapper.append(label, canvas);
    return wrapper;
  }

  private applyFilter(): void {
    if (this.entries.length === 0) {
      this.grid.replaceChildren();
      this.countLabel.textContent = "0 entries";
      return;
    }

    const query = this.searchInput.value.toLowerCase().trim();
    const sourceKind = this.sourceSelect.value as "" | ModernInteriorsSourceKind;
    const category = this.categorySelect.value;
    const variant = this.variantSelect.value as "" | ModernInteriorsVariant;
    const matched = this.entries.filter((entry) => {
      if (sourceKind && entry.sourceKind !== sourceKind) return false;
      if (category && entry.category !== category) return false;
      if (variant && entry.variant !== variant) return false;
      if (!query) return true;
      return (
        entry.key.toLowerCase().includes(query) ||
        entry.theme.toLowerCase().includes(query) ||
        entry.category.toLowerCase().includes(query) ||
        entry.tags.some((tag) => tag.toLowerCase().includes(query))
      );
    });

    const visible = matched.slice(0, MAX_VISIBLE_ENTRIES);
    this.countLabel.textContent =
      matched.length > visible.length
        ? `${visible.length}/${matched.length} entries`
        : `${matched.length} entries`;
    this.renderGrid(visible);
  }

  private renderGrid(entries: ModernInteriorsAtlasEntry[]): void {
    this.grid.replaceChildren();
    for (const entry of entries) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.style.cssText = CELL_STYLE;
      cell.title = entry.key;
      cell.addEventListener("mouseenter", () => {
        cell.style.borderColor = "#9bd7ff";
        cell.style.background = "rgba(155,215,255,0.11)";
      });
      cell.addEventListener("mouseleave", () => {
        cell.style.borderColor = "#3f4a5c";
        cell.style.background = "rgba(255,255,255,0.035)";
      });
      cell.addEventListener("click", () => this.selectEntry(entry));

      const thumb = document.createElement("canvas");
      thumb.style.cssText = "image-rendering: pixelated; pointer-events: none; max-width: 96px;";
      this.drawEntry(thumb, entry, 96, 64);
      cell.appendChild(thumb);

      const label = document.createElement("div");
      label.style.cssText = LABEL_STYLE;
      label.textContent = displayName(entry);
      cell.appendChild(label);

      this.grid.appendChild(cell);
    }
  }

  private selectEntry(entry: ModernInteriorsAtlasEntry): void {
    const [x, y, w, h] = entry.rect;
    this.detail.textContent = `${entry.key} | ${entry.sourceKind} | ${entry.category} | ${w}x${h} @ ${x},${y}`;
  }

  private renderPrefabPreview(): void {
    if (!this.designSelect.value || !isModernInteriorsAtlasLoaded()) return;
    const layers = getModernInteriorsDesignLayers(this.designSelect.value);
    const stackLayers = layers
      .filter((entry) => entry.layer !== "preview")
      .sort(compareModernInteriorsLayers);
    const preview = layers.find((entry) => entry.layer === "preview");

    if (this.layerControlDesign !== this.designSelect.value) {
      this.layerControlDesign = this.designSelect.value;
      this.enabledLayers = new Set(stackLayers.map((entry) => entry.layer ?? entry.key));
      this.renderLayerControls(stackLayers);
    }

    this.drawComposite(
      this.stackCanvas,
      stackLayers.filter((entry) => this.enabledLayers.has(entry.layer ?? entry.key)),
      480,
    );
    if (preview) {
      this.drawEntry(this.sourcePreviewCanvas, preview, 480, 320);
    } else {
      this.clearCanvas(this.sourcePreviewCanvas, 224, 128, 1);
    }
  }

  private renderGeneratedRoomPreview(): void {
    if (!this.atlasImage || !isModernInteriorsAtlasLoaded()) return;
    drawRoomGrammarPreview(this.generatedRoomCanvas, this.atlasImage);
    const differences = drawGenericHomeGeometryStudy(this.geometryStudyCanvas, this.atlasImage);
    this.geometryStudyCanvas.dataset.visibleDifferences = String(differences);
    this.layerStudyCanvas.dataset.overlapCells = String(
      drawGenericHomeLayerStudy(this.layerStudyCanvas, this.atlasImage),
    );
    drawConnectedRoomGrammarPreview(this.connectedRoomCanvas, this.atlasImage);
    for (const [index, example] of ADVANCED_SUITE_EXAMPLES.entries()) {
      const canvas = this.advancedSuiteCanvases[index];
      if (canvas)
        canvas.dataset.reachable = String(
          drawAdvancedSuitePreview(canvas, this.atlasImage, example),
        );
    }
    drawGenericHomeVariantPreview(this.geometryVariantCanvas, this.atlasImage);
    this.renderApartmentPreview();
  }

  private renderApartmentPreview(): void {
    try {
      const plan = parseFloorPlan(this.apartmentSketch.value);
      this.apartmentStatus.textContent = describeFloorPlan(plan);
      this.apartmentStatus.style.color = "#a8dcb9";
      if (this.atlasImage && isModernInteriorsAtlasLoaded()) {
        drawApartmentPlan(this.apartmentCanvas, this.atlasImage, plan);
      }
    } catch (error) {
      this.apartmentStatus.textContent = error instanceof Error ? error.message : String(error);
      this.apartmentStatus.style.color = "#ff9b9b";
      this.apartmentCanvas.width = 1;
      this.apartmentCanvas.height = 1;
    }
  }

  private renderLayerControls(layers: ModernInteriorsAtlasEntry[]): void {
    this.layerControls.replaceChildren();
    for (const entry of layers) {
      const key = entry.layer ?? entry.key;
      const label = document.createElement("label");
      label.style.cssText =
        "display: inline-flex; align-items: center; gap: 5px; color: #cdd6e3; font: 11px monospace;";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = this.enabledLayers.has(key);
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) this.enabledLayers.add(key);
        else this.enabledLayers.delete(key);
        this.renderPrefabPreview();
      });

      const text = document.createElement("span");
      text.textContent = formatSlug(key);
      label.append(checkbox, text);
      this.layerControls.appendChild(label);
    }
  }

  private clearCanvas(
    canvas: HTMLCanvasElement,
    width: number,
    height: number,
    scale: number,
  ): void {
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = `${width * scale}px`;
    canvas.style.height = `${height * scale}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawChecker(ctx, width, height);
  }

  private drawEntry(
    canvas: HTMLCanvasElement,
    entry: ModernInteriorsAtlasEntry,
    maxWidth: number,
    maxHeight: number,
  ): void {
    const { width, height } = naturalSize(entry);
    const scale = Math.max(
      1,
      Math.min(4, Math.floor(Math.min(maxWidth / width, maxHeight / height))),
    );
    this.clearCanvas(canvas, width, height, scale);
    if (!this.atlasImage) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    const [x, y, w, h] = entry.rect;
    ctx.drawImage(this.atlasImage, x, y, w, h, 0, 0, w, h);
  }

  private drawComposite(
    canvas: HTMLCanvasElement,
    layers: ModernInteriorsAtlasEntry[],
    maxCssWidth: number,
  ): void {
    const width = Math.max(1, ...layers.map((entry) => entry.rect[2]));
    const height = Math.max(1, ...layers.map((entry) => entry.rect[3]));
    const scale = Math.max(1, Math.min(3, Math.floor(maxCssWidth / width)));
    this.clearCanvas(canvas, width, height, scale);
    if (!this.atlasImage) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    for (const entry of layers) {
      const [x, y, w, h] = entry.rect;
      ctx.drawImage(this.atlasImage, x, y, w, h, 0, 0, w, h);
    }
  }
}
