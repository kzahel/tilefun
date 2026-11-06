import type { Spritesheet } from "../assets/Spritesheet.js";
import type { BlendGraph } from "../autotile/BlendGraph.js";
import { PROP_PALETTE } from "../entities/PropFactories.js";
import { activateMenu, deactivateMenu } from "../ui/MenuNavigation.js";
import { EditorBrushTools } from "./EditorBrushTools.js";
import { EditorElevationPalette } from "./EditorElevationPalette.js";
import type { EditorModel } from "./EditorModel.js";
import {
  ALL_TABS,
  type EditorTab,
  ENTITY_PALETTE,
  NATURAL_SHEET_PALETTE,
  ROAD_PALETTE,
  STRUCTURE_PALETTE,
  VEHICLE_PALETTE,
} from "./EditorPalettes.js";
import type { EditorSection, EditorSectionHost } from "./EditorPanelWidgets.js";
import { EditorPatternPalette } from "./EditorPatternPalette.js";
import {
  EditorEntityPalette,
  EditorPropPalette,
  EditorVehiclePalette,
} from "./EditorPlacementPalettes.js";
import { EditorTerrainPalettes } from "./EditorTerrainPalettes.js";

export type { EditorTab };

const PANEL_STYLE = `
  position: fixed; bottom: 0; left: 0; right: 0;
  background: rgba(0,0,0,0.8); color: #fff;
  font: 13px monospace;
  border-radius: 6px 6px 0 0; z-index: 100;
  display: none; user-select: none;
  flex-direction: column;
`;

const TAB_STYLE = `
  padding: 10px 14px; border: none; border-radius: 6px 6px 0 0;
  font: bold 12px monospace; cursor: pointer; min-height: 44px;
  display: flex; align-items: center; gap: 5px; flex: 0 0 auto; white-space: nowrap;
`;

const TAB_ICONS: Record<EditorTab, string> = {
  natural: "\ud83c\udf3f",
  road: "\ud83d\udee3\ufe0f",
  structure: "\ud83c\udfd7\ufe0f",
  entities: "\ud83d\udc25",
  vehicles: "🚗",
  props: "\ud83c\udf32",
  elevation: "\u26f0\ufe0f",
  patterns: "▥",
};

const TAB_LABELS: Record<EditorTab, string> = {
  natural: "Natural",
  road: "Road",
  structure: "Structure",
  entities: "Entities",
  vehicles: "Vehicles",
  props: "Props",
  elevation: "Elevation",
  patterns: "Patterns",
};

/**
 * Bottom editor tray: header (selection/minimize, Play), category tabs and a
 * scrolling palette area composed from per-tab sections.
 */
export class EditorPanel {
  readonly el: HTMLDivElement;
  private readonly container: HTMLDivElement;
  private readonly model: EditorModel;
  private readonly collapseArrow: HTMLButtonElement;
  private readonly selectionLabel: HTMLSpanElement;
  private readonly tabBar: HTMLDivElement;
  private readonly paletteScroll: HTMLDivElement;
  private minimized = false;
  private displayedTab: EditorTab | null = null;
  private readonly tabButtons: Map<EditorTab, HTMLButtonElement> = new Map();
  private readonly terrain: EditorTerrainPalettes;
  private readonly entities: EditorEntityPalette;
  private readonly vehicles: EditorVehiclePalette;
  private readonly props: EditorPropPalette;
  /** Palette sections in scroll-area order. */
  private readonly sections: readonly EditorSection[];
  private controllerOpen = false;
  toggleController(): void {
    if (!this.visible) return;
    this.controllerOpen = !this.controllerOpen;
    if (this.controllerOpen) {
      this.minimized = false;
      this.updateTray();
      activateMenu(this.container, () => {
        this.controllerOpen = false;
        deactivateMenu(this.container);
      });
    } else deactivateMenu(this.container);
  }

  constructor(model: EditorModel) {
    this.model = model;
    this.container = document.createElement("div");
    this.el = this.container;
    this.container.style.cssText = PANEL_STYLE;
    this.container.className = "editor-panel";
    this.container.dataset.testid = "editor-panel";
    this.container.style.display = "none";

    // Subscribe to model changes
    model.addListener(() => this.syncFromModel());

    // Minimize tools independently of switching between editing and play.
    const header = document.createElement("div");
    header.className = "editor-panel-header";
    this.collapseArrow = document.createElement("button");
    this.collapseArrow.className = "editor-panel-toggle";
    this.selectionLabel = document.createElement("span");
    this.selectionLabel.dataset.testid = "editor-selection";
    this.collapseArrow.appendChild(this.selectionLabel);
    this.collapseArrow.addEventListener("click", () => {
      this.minimized = !this.minimized;
      this.updateTray();
      this.revealSelectedTab();
    });
    const play = document.createElement("button");
    play.className = "editor-panel-play";
    play.textContent = "Play";
    play.title = "Return to play (Tab)";
    play.setAttribute("aria-label", "Exit editor");
    play.onclick = () => this.model.onExitEditor?.();
    header.append(this.collapseArrow, play);
    this.container.appendChild(header);

    this.tabBar = this.buildTabBar();
    this.container.appendChild(this.tabBar);
    this.paletteScroll = document.createElement("div");
    this.paletteScroll.className = "editor-palette-scroll";
    this.paletteScroll.dataset.testid = "editor-palette-scroll";
    this.container.appendChild(this.paletteScroll);

    const host: EditorSectionHost = { model, sync: () => this.syncFromModel() };
    this.terrain = new EditorTerrainPalettes(host);
    this.entities = new EditorEntityPalette(host);
    this.vehicles = new EditorVehiclePalette(host);
    this.props = new EditorPropPalette(host);
    this.sections = [
      new EditorBrushTools(host),
      this.terrain,
      this.entities,
      this.vehicles,
      this.props,
      new EditorPatternPalette(host),
      new EditorElevationPalette(host),
    ];
    for (const section of this.sections) this.paletteScroll.append(...section.rows);

    // Initial sync
    this.syncFromModel();
    document.body.appendChild(this.container);
  }

  private buildTabBar(): HTMLDivElement {
    const tabBar = document.createElement("div");
    tabBar.className = "editor-tabs";
    tabBar.dataset.testid = "editor-tabs";
    tabBar.setAttribute("aria-label", "Editor categories");
    for (const tab of ALL_TABS) {
      const btn = document.createElement("button");
      btn.style.cssText = TAB_STYLE;
      const icon = document.createElement("span");
      icon.style.fontSize = "15px";
      icon.textContent = TAB_ICONS[tab];
      btn.appendChild(icon);
      btn.appendChild(document.createTextNode(TAB_LABELS[tab]));
      btn.addEventListener("click", () => this.model.setTab(tab));
      btn.dataset.editorTab = tab;
      tabBar.appendChild(btn);
      this.tabButtons.set(tab, btn);
    }
    return tabBar;
  }

  /** Synchronize all DOM state from the model. */
  private syncFromModel(): void {
    this.updateTabDisplay();
    for (const section of this.sections) section.sync();
    this.updateTray();
    if (this.displayedTab !== this.model.editorTab) {
      this.displayedTab = this.model.editorTab;
      this.paletteScroll.scrollTop = 0;
      this.revealSelectedTab();
    }
  }

  private updateTabDisplay(): void {
    const active = "background: #555; color: #fff;";
    const inactive = "background: #222; color: #888;";
    for (const [tab, btn] of this.tabButtons) {
      if (tab === "patterns" && btn.lastChild)
        btn.lastChild.textContent = this.model.indoor ? "Rooms" : "Patterns";
      btn.style.cssText = TAB_STYLE + (tab === this.model.editorTab ? active : inactive);
      btn.style.display =
        !this.model.indoor || tab === "patterns" || tab === "props" ? "flex" : "none";
    }
  }

  private updateTray(): void {
    this.container.dataset.minimized = String(this.minimized);
    const action = this.minimized ? "Expand editor tools" : "Minimize editor tools";
    this.collapseArrow.title = action;
    this.collapseArrow.setAttribute("aria-label", action);
    this.collapseArrow.setAttribute("aria-expanded", String(!this.minimized));
    this.selectionLabel.textContent = this.selectionName();
  }

  private selectionName(): string {
    const model = this.model;
    switch (model.editorTab) {
      case "props":
        return model.deleteMode
          ? "Delete props"
          : (PROP_PALETTE.find((entry) => entry.type === model.selectedPropType)?.label ??
              model.selectedPropType
                .replace(/^(prop-interior-furniture:|prop-|atlas:)/, "")
                .replace(/[-_]/g, " "));
      case "vehicles":
        return model.deleteMode
          ? "Delete vehicles"
          : (VEHICLE_PALETTE.find((entry) => entry.type === model.selectedVehicleType)?.label ??
              "Vehicles");
      case "entities":
        return model.deleteMode
          ? "Delete entities"
          : (ENTITY_PALETTE.find((entry) => entry.type === model.selectedEntityType)?.label ??
              "Entities");
      case "natural":
        return model.selectedTerrain === null
          ? "Auto terrain"
          : (NATURAL_SHEET_PALETTE[model.selectedNaturalIndex]?.label ?? "Natural");
      case "road":
        return (
          ROAD_PALETTE.find((entry) => entry.roadType === model.selectedRoadType)?.label ?? "Road"
        );
      case "structure":
        return (
          STRUCTURE_PALETTE.find((entry) => entry.terrainId === model.selectedTerrain)?.label ??
          "Auto terrain"
        );
      case "elevation":
        return `Height ${model.selectedElevation}`;
      case "patterns":
        return model.indoor
          ? model.roomRectangle
            ? "Room rectangle"
            : "Room drawing"
          : "Fenced trees";
    }
  }

  private revealSelectedTab(): void {
    const button = this.tabButtons.get(this.model.editorTab);
    if (!button || !this.visible || this.minimized) return;
    const selected = button.getBoundingClientRect();
    const row = this.tabBar.getBoundingClientRect();
    if (selected.left < row.left + 8)
      this.tabBar.scrollLeft -= Math.ceil(row.left + 8 - selected.left);
    else if (selected.right > row.right - 8)
      this.tabBar.scrollLeft += Math.ceil(selected.right - row.right + 8);
  }

  get visible(): boolean {
    return this.container.style.display !== "none";
  }

  set visible(v: boolean) {
    if (!v) {
      this.controllerOpen = false;
      deactivateMenu(this.container);
    }
    if (v && !this.visible) this.minimized = false;
    this.container.style.display = v ? "flex" : "none";
    if (v) {
      this.updateTray();
      this.revealSelectedTab();
    }
  }

  /** Render actual tile/sprite graphics into preview buttons once assets are loaded. */
  setAssets(
    sheets: Map<string, Spritesheet>,
    blendSheets: Spritesheet[],
    blendGraph: BlendGraph,
  ): void {
    this.terrain.setBlendAssets(blendSheets, blendGraph);
    this.entities.setAssets(sheets);
    this.vehicles.setAssets(sheets);
    this.props.setAssets(sheets);
    this.terrain.setRoadAssets(sheets);
  }
}
