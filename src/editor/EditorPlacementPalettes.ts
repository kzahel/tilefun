import type { Spritesheet } from "../assets/Spritesheet.js";
import { Direction } from "../entities/Entity.js";
import { ENTITY_DEFS } from "../entities/EntityDefs.js";
import { getPropSheetInfo, PROP_PALETTE } from "../entities/PropFactories.js";
import { vehicleFrameDirection, vehicleView } from "../traffic/Vehicle.js";
import { originalPaintSwatches, vehiclePaintSchemes } from "../traffic/VehiclePaint.js";
import { ENTITY_PALETTE, VEHICLE_PALETTE } from "./EditorPalettes.js";
import {
  BTN_STYLE,
  DeleteToggles,
  type EditorSection,
  type EditorSectionHost,
  highlight,
  makeLabel,
  makeRow,
  makeSeparator,
  opaqueRegion,
  paletteButtonStyle,
  ROW_STYLE,
  renderPreviewCanvas,
} from "./EditorPanelWidgets.js";

const INDOOR_FURNITURE = [
  "single-bed",
  "side-table",
  "dresser",
  "worktable",
  "stool",
  "potted-tree",
  "fireplace",
  "log-rack",
];

function appendEntityLabel(button: HTMLButtonElement, label: string): void {
  button.querySelector(".editor-entity-name")?.remove();
  const caption = document.createElement("span");
  caption.className = "editor-entity-name";
  caption.textContent = label;
  caption.setAttribute("aria-hidden", "true");
  button.append(caption);
}

/** Creature/NPC placement row. */
export class EditorEntityPalette implements EditorSection {
  readonly rows: readonly HTMLElement[];
  private readonly entityRow = makeRow();
  private readonly entityButtons: HTMLButtonElement[] = [];
  private readonly deletes: DeleteToggles;

  constructor(private readonly host: EditorSectionHost) {
    this.deletes = new DeleteToggles(host);
    for (const entry of ENTITY_PALETTE) {
      const btn = document.createElement("button");
      btn.className = "editor-entity-button";
      btn.type = "button";
      btn.style.background = entry.color;
      appendEntityLabel(btn, entry.label);
      btn.title = `Place ${entry.label} (click map)`;
      btn.setAttribute("aria-label", btn.title);
      btn.addEventListener("click", () => {
        host.model.selectedEntityType = entry.type;
        host.model.deleteMode = false;
        host.sync();
      });
      this.entityButtons.push(btn);
      this.entityRow.appendChild(btn);
    }

    this.entityRow.appendChild(makeSeparator());
    this.entityRow.appendChild(this.deletes.create());
    this.rows = [this.entityRow];
  }

  sync(): void {
    const model = this.host.model;
    this.entityRow.style.display = model.editorTab === "entities" ? "flex" : "none";
    for (const [i, entry] of ENTITY_PALETTE.entries()) {
      const btn = this.entityButtons[i];
      if (btn) highlight(btn, entry.type === model.selectedEntityType);
    }
    this.deletes.sync();
  }

  /** Fit the visible creature, not the transparent animation/anchor margins. */
  setAssets(sheets: Map<string, Spritesheet>): void {
    for (const [i, entry] of ENTITY_PALETTE.entries()) {
      const btn = this.entityButtons[i];
      if (!btn) continue;
      const sprite = ENTITY_DEFS[entry.type]?.sprite;
      const sheet = sheets.get(sprite?.sheetKey ?? entry.type);
      if (!sheet) continue;
      const facing = entry.previewRow ?? Direction.Down;
      const row = facing < sheet.rows ? facing : 0;
      const col = sprite?.clips?.[0]?.start ?? 0;
      renderPreviewCanvas(btn, sheet, col, row, 84, 52, opaqueRegion(sheet, row, col));
      btn.style.background = "#4b5563";
      appendEntityLabel(btn, entry.label);
    }
  }
}

/** Parked-vehicle picker plus the sticky paint row for the selected vehicle. */
export class EditorVehiclePalette implements EditorSection {
  readonly rows: readonly HTMLElement[];
  private readonly vehicleRow = makeRow();
  private readonly vehiclePaintRow = document.createElement("div");
  private vehiclePaintSelection = "";
  private readonly vehicleButtons: HTMLButtonElement[] = [];
  private readonly deletes: DeleteToggles;

  constructor(private readonly host: EditorSectionHost) {
    this.deletes = new DeleteToggles(host);
    this.vehicleRow.setAttribute("role", "group");
    this.vehicleRow.setAttribute("aria-label", "Vehicle picker");
    for (const entry of VEHICLE_PALETTE) {
      const button = document.createElement("button");
      button.style.cssText = `${BTN_STYLE}width: 96px; height: 78px; padding: 2px; flex-direction: column;`;
      button.textContent = entry.label;
      button.title = `Place ${entry.label} (click map)`;
      button.setAttribute("aria-label", entry.label);
      button.onclick = () => {
        host.model.selectedVehicleType = entry.type;
        host.model.selectedVehiclePaint = undefined;
        host.model.deleteMode = false;
        host.sync();
      };
      this.vehicleButtons.push(button);
      this.vehicleRow.append(button);
    }
    this.vehicleRow.append(makeSeparator(), this.deletes.create());
    this.vehiclePaintRow.style.cssText = `${ROW_STYLE}position: sticky; top: 0; z-index: 2; background: #20242b; border-bottom: 1px solid #667;`;
    this.vehiclePaintRow.setAttribute("role", "group");
    this.vehiclePaintRow.setAttribute("aria-label", "Vehicle paint");
    this.rows = [this.vehiclePaintRow, this.vehicleRow];
  }

  sync(): void {
    const model = this.host.model;
    this.vehicleRow.style.display = model.editorTab === "vehicles" ? "flex" : "none";
    const paints = vehiclePaintSchemes(model.selectedVehicleType);
    this.vehiclePaintRow.style.display =
      model.editorTab === "vehicles" && !model.deleteMode && paints.length ? "flex" : "none";
    const key = model.selectedVehicleType;
    if (key !== this.vehiclePaintSelection) {
      this.vehiclePaintSelection = key;
      this.rebuildPaintButtons(paints);
    }
    for (const button of this.vehiclePaintRow.querySelectorAll("button")) {
      const selected = button.dataset.paintId === (model.selectedVehiclePaint ?? "");
      button.setAttribute("aria-pressed", String(selected));
      button.style.borderColor = selected ? "#fff" : "#888";
    }
    for (const [index, entry] of VEHICLE_PALETTE.entries()) {
      const button = this.vehicleButtons[index];
      if (button)
        button.style.borderColor = entry.type === model.selectedVehicleType ? "#fff" : "#888";
    }
    this.deletes.sync();
  }

  private rebuildPaintButtons(paints: ReturnType<typeof vehiclePaintSchemes>): void {
    const model = this.host.model;
    this.vehiclePaintRow.replaceChildren(makeLabel("Paint"));
    for (const paint of [
      {
        id: "",
        name: "Original",
        swatches: originalPaintSwatches(model.selectedVehicleType),
      },
      ...paints,
    ]) {
      const selected = (model.selectedVehiclePaint ?? "") === paint.id;
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.paintId = paint.id;
      button.setAttribute("aria-label", `Paint: ${paint.name}`);
      button.setAttribute("aria-pressed", String(selected));
      button.title = paint.name;
      const colors = paint.swatches.map((rgb) => `rgb(${rgb.join(",")})`);
      button.style.cssText = `${BTN_STYLE}min-width: 72px; background: linear-gradient(135deg, ${colors[0]} 50%, ${colors.at(-1)} 50%); text-shadow: 0 1px 3px #000, 0 0 4px #000;`;
      button.style.borderColor = selected ? "#fff" : "#888";
      button.textContent = paint.name;
      button.onclick = () => {
        model.selectedVehiclePaint = paint.id || undefined;
        this.host.sync();
      };
      this.vehiclePaintRow.append(button);
    }
  }

  setAssets(sheets: Map<string, Spritesheet>): void {
    for (const [index, entry] of VEHICLE_PALETTE.entries()) {
      const button = this.vehicleButtons[index],
        sheet = sheets.get(entry.type);
      const view = vehicleView(entry.type, Direction.Right),
        collider = view?.metadata.colliders[0];
      if (!button || !sheet || !view || !collider) continue;
      const frame = sheet.getRegion(0, vehicleFrameDirection(entry.type, Direction.Right));
      renderPreviewCanvas(button, sheet, 0, 0, 92, 48, {
        x: frame.x + 96 - (view.metadata.anchor[0] ?? 0) - collider.offsetX,
        y: frame.y + 144 - (view.metadata.anchor[1] ?? 0) - collider.offsetY + collider.height / 2,
        width: view.rect[2] ?? 1,
        height: view.rect[3] ?? 1,
      });
      const label = document.createElement("span");
      label.textContent = entry.label;
      label.style.cssText = "font-size: 10px; line-height: 12px; pointer-events: none;";
      button.append(label);
    }
  }
}

const PROP_CATEGORY_LABELS: Record<string, string> = {
  nature: "Nature",
  building: "Buildings",
};

/** Outdoor prop palette (with the sprite atlas browser) and the indoor furniture row. */
export class EditorPropPalette implements EditorSection {
  readonly rows: readonly HTMLElement[];
  private readonly propsRow = makeRow();
  private readonly indoorProps = makeRow();
  private readonly propButtons: HTMLButtonElement[] = [];
  private readonly deletes: DeleteToggles;

  constructor(private readonly host: EditorSectionHost) {
    this.deletes = new DeleteToggles(host);
    this.buildPropsRow();
    this.buildIndoorRow();
    this.rows = [this.propsRow, this.indoorProps];
  }

  private selectProp(type: string): void {
    this.host.model.selectedPropType = type;
    this.host.model.deleteMode = false;
    this.host.sync();
  }

  private buildPropsRow(): void {
    let lastCategory = "";
    for (const entry of PROP_PALETTE) {
      if (entry.category !== lastCategory) {
        if (lastCategory !== "") this.propsRow.appendChild(makeSeparator());
        this.propsRow.appendChild(makeLabel(PROP_CATEGORY_LABELS[entry.category] ?? "Playground"));
        lastCategory = entry.category;
      }
      const btn = document.createElement("button");
      btn.style.cssText = paletteButtonStyle(entry.color, "#fff", 64);
      btn.textContent = entry.label;
      btn.title = `Place ${entry.label} (click map)`;
      btn.setAttribute("aria-label", btn.title);
      btn.addEventListener("click", () => this.selectProp(entry.type));
      this.propButtons.push(btn);
      this.propsRow.appendChild(btn);
    }

    this.propsRow.appendChild(makeSeparator());

    const browseBtn = document.createElement("button");
    browseBtn.style.cssText = `
      width: 80px; height: 44px; border: 2px solid #8cf; border-radius: 4px;
      background: rgba(100,160,255,0.15); color: #8cf; font: bold 10px monospace;
      cursor: pointer; display: flex; align-items: center; justify-content: center;
    `;
    browseBtn.textContent = "Atlas...";
    browseBtn.title = "Browse 4800+ sprites from Modern Exteriors";
    browseBtn.addEventListener("click", () => this.host.model.onOpenCatalog?.());
    this.propsRow.appendChild(browseBtn);

    this.propsRow.appendChild(makeSeparator());
    this.propsRow.appendChild(this.deletes.create());
  }

  private buildIndoorRow(): void {
    for (const asset of INDOOR_FURNITURE) {
      const button = document.createElement("button");
      button.textContent = asset;
      button.dataset.furnitureType = `prop-interior-furniture:${asset}`;
      button.style.cssText = BTN_STYLE;
      button.onclick = () => this.selectProp(`prop-interior-furniture:${asset}`);
      this.indoorProps.appendChild(button);
    }
    this.indoorProps.appendChild(this.deletes.create());
  }

  sync(): void {
    const model = this.host.model;
    this.indoorProps.style.display = model.indoor && model.editorTab === "props" ? "flex" : "none";
    for (const button of this.indoorProps.querySelectorAll<HTMLButtonElement>(
      "[data-furniture-type]",
    ))
      button.style.borderColor =
        button.dataset.furnitureType === model.selectedPropType ? "#8cf" : "#888";
    this.propsRow.style.display = !model.indoor && model.editorTab === "props" ? "flex" : "none";
    for (const [i, entry] of PROP_PALETTE.entries()) {
      const btn = this.propButtons[i];
      if (btn) highlight(btn, entry.type === model.selectedPropType);
    }
    this.deletes.sync();
  }

  /** Prop buttons: draw sprite preview from the prop's own sheet. */
  setAssets(sheets: Map<string, Spritesheet>): void {
    for (const [i, entry] of PROP_PALETTE.entries()) {
      const btn = this.propButtons[i];
      const info = btn ? getPropSheetInfo(entry.type) : undefined;
      const sheet = info ? sheets.get(info.sheetKey) : undefined;
      if (btn && info && sheet) renderPreviewCanvas(btn, sheet, info.col, info.row, 64, 44);
    }
  }
}
