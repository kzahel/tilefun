import {
  type AtlasSpriteEntry,
  getAtlasEntries,
  getAtlasThemes,
  isAtlasLoaded,
} from "../assets/AtlasIndex.js";

const OVERLAY_STYLE = `
  position: fixed; inset: 0; z-index: 250;
  background: rgba(10, 10, 30, 0.95);
  display: flex; flex-direction: column;
  font-family: monospace; color: #fff;
  overflow: hidden;
  padding: env(safe-area-inset-top) env(safe-area-inset-right)
    env(safe-area-inset-bottom) env(safe-area-inset-left);
`;

const HEADER_STYLE = `
  display: flex; flex-direction: column; gap: 8px;
  padding: 8px 12px; border-bottom: 1px solid #444;
  flex-shrink: 0;
`;

const INPUT_STYLE = `
  min-width: 0; width: 100%; min-height: 44px; font: 14px monospace; padding: 6px 10px;
  background: rgba(255,255,255,0.1); color: #fff;
  border: 1px solid #888; border-radius: 4px; outline: none;
`;

const SELECT_STYLE = `
  font: 13px monospace; padding: 6px 8px;
  min-width: 0; width: 100%; min-height: 44px;
  background: #222; color: #fff;
  border: 1px solid #888; border-radius: 4px;
`;

const CLOSE_BTN_STYLE = `
  font: bold 18px monospace; padding: 4px 10px;
  background: none; color: #aaa; border: 1px solid #666;
  border-radius: 4px; cursor: pointer; margin-left: auto;
  flex-shrink: 0; min-width: 44px; min-height: 44px;
`;

const GRID_STYLE = `
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(84px, 1fr));
  gap: 4px; padding: 8px;
  overflow-y: auto; flex: 1; min-height: 0;
  overscroll-behavior: contain;
`;

const CELL_STYLE = `
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  padding: 4px; border: 2px solid #444;
  border-radius: 4px; cursor: pointer;
  min-height: 80px; background: rgba(255,255,255,0.03);
`;

const LABEL_STYLE = `
  font: 9px monospace; color: #aaa; text-align: center;
  overflow: hidden; text-overflow: ellipsis;
  white-space: nowrap; max-width: 76px; margin-top: 2px;
`;

/** Pretty-print theme names for the dropdown. */
function formatTheme(theme: string): string {
  return theme
    .replace(/^ME_Singles_/, "")
    .replace(/^\d+_/, "")
    .replace(/_/g, " ");
}

export class PropCatalog {
  private overlay: HTMLDivElement;
  private searchInput: HTMLInputElement;
  private themeSelect: HTMLSelectElement;
  private countLabel: HTMLSpanElement;
  private grid: HTMLDivElement;
  private cells: { el: HTMLDivElement; entry: AtlasSpriteEntry }[] = [];
  private meCompleteImage: CanvasImageSource | null = null;
  private thumbnailsRendered = false;

  onSelect: ((propType: string) => void) | null = null;
  onClose: (() => void) | null = null;

  constructor() {
    this.overlay = document.createElement("div");
    this.overlay.style.cssText = OVERLAY_STYLE;
    this.overlay.style.display = "none";
    this.overlay.dataset.testid = "prop-catalog";
    this.overlay.setAttribute("role", "dialog");
    this.overlay.setAttribute("aria-label", "Sprite Catalog");
    this.overlay.setAttribute("aria-modal", "true");

    // Header
    const header = document.createElement("div");
    header.style.cssText = HEADER_STYLE;
    const titleRow = document.createElement("div");
    titleRow.style.cssText = "display:flex; align-items:center; gap:8px; min-width:0;";
    const filters = document.createElement("div");
    filters.style.cssText =
      "display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:8px;";

    const title = document.createElement("span");
    title.style.cssText = "font: bold 16px monospace; color: #8cf; flex:1; min-width:0;";
    title.textContent = "Sprite Catalog";
    titleRow.appendChild(title);

    this.searchInput = document.createElement("input");
    this.searchInput.type = "text";
    this.searchInput.placeholder = "Search sprites...";
    this.searchInput.setAttribute("aria-label", "Search sprites");
    this.searchInput.style.cssText = INPUT_STYLE;
    filters.appendChild(this.searchInput);

    this.themeSelect = document.createElement("select");
    this.themeSelect.style.cssText = SELECT_STYLE;
    this.themeSelect.setAttribute("aria-label", "Sprite theme");
    const allOption = document.createElement("option");
    allOption.value = "";
    allOption.textContent = "All themes";
    this.themeSelect.appendChild(allOption);
    filters.appendChild(this.themeSelect);

    this.countLabel = document.createElement("span");
    this.countLabel.style.cssText = "font: 12px monospace; color: #888;";
    titleRow.appendChild(this.countLabel);

    const closeBtn = document.createElement("button");
    closeBtn.style.cssText = CLOSE_BTN_STYLE;
    closeBtn.textContent = "\u00d7";
    closeBtn.title = "Close (Escape)";
    closeBtn.setAttribute("aria-label", "Close sprite catalog");
    closeBtn.addEventListener("click", () => this.requestClose());
    titleRow.appendChild(closeBtn);
    header.append(titleRow, filters);

    const toolsLink = document.createElement("a");
    toolsLink.href = "tools.html";
    toolsLink.textContent = "Indexes & atlases →";
    toolsLink.style.cssText =
      "display:block; padding:8px 12px; color:#e9c36c; font:12px monospace; flex-shrink:0;";
    this.overlay.append(header, toolsLink);

    // Grid
    this.grid = document.createElement("div");
    this.grid.style.cssText = GRID_STYLE;
    this.overlay.appendChild(this.grid);

    // Event listeners
    let debounceTimer = 0;
    this.searchInput.addEventListener("input", () => {
      clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => this.applyFilter(), 150);
    });
    this.themeSelect.addEventListener("change", () => this.applyFilter());

    // Stop all events from reaching the game layer beneath
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

  /** Populate theme dropdown and sprite cells after atlas index is loaded. */
  populateAtlas(): void {
    if (!isAtlasLoaded()) return;
    for (const theme of getAtlasThemes()) {
      const opt = document.createElement("option");
      opt.value = theme;
      opt.textContent = formatTheme(theme);
      this.themeSelect.appendChild(opt);
    }
    this.buildCells();
  }

  setImage(img: CanvasImageSource): void {
    this.meCompleteImage = img;
  }

  get visible(): boolean {
    return this.overlay.style.display !== "none";
  }

  show(): void {
    this.overlay.style.display = "flex";
    this.searchInput.value = "";
    this.themeSelect.value = "";
    this.applyFilter();
    if (!this.thumbnailsRendered) {
      this.renderThumbnails();
      this.thumbnailsRendered = true;
    }
    // Touch users can browse immediately without the keyboard covering the grid.
    if (window.matchMedia("(pointer: fine)").matches) this.searchInput.focus();
  }

  private requestClose(): void {
    if (this.onClose) this.onClose();
    else this.hide();
  }

  hide(): void {
    this.overlay.style.display = "none";
  }

  private buildCells(): void {
    const entries = getAtlasEntries();
    for (const entry of entries) {
      const cell = document.createElement("div");
      cell.style.cssText = CELL_STYLE;
      cell.title = `${entry.sprite.name} (${entry.sprite.w}x${entry.sprite.h}) — ${formatTheme(entry.sprite.theme)}`;

      cell.addEventListener("mouseenter", () => {
        cell.style.borderColor = "#8cf";
        cell.style.background = "rgba(255,255,255,0.1)";
      });
      cell.addEventListener("mouseleave", () => {
        cell.style.borderColor = "#444";
        cell.style.background = "rgba(255,255,255,0.03)";
      });
      cell.addEventListener("click", () => {
        this.onSelect?.(entry.propType);
        this.hide();
      });

      const label = document.createElement("div");
      label.style.cssText = LABEL_STYLE;
      label.textContent = entry.sprite.name;
      cell.appendChild(label);

      this.cells.push({ el: cell, entry });
      this.grid.appendChild(cell);
    }
  }

  private renderThumbnails(): void {
    if (!this.meCompleteImage) return;
    const img = this.meCompleteImage;
    for (const { el, entry } of this.cells) {
      const canvas = document.createElement("canvas");
      const s = entry.sprite;
      const maxDim = 64;
      const scale = Math.min(maxDim / s.w, maxDim / s.h, 3);
      canvas.width = Math.ceil(s.w * scale);
      canvas.height = Math.ceil(s.h * scale);
      canvas.style.cssText = "image-rendering: pixelated; pointer-events: none;";
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, s.x, s.y, s.w, s.h, 0, 0, canvas.width, canvas.height);
      }
      el.insertBefore(canvas, el.firstChild);
    }
  }

  private applyFilter(): void {
    const query = this.searchInput.value.toLowerCase().trim();
    const theme = this.themeSelect.value;
    let count = 0;
    for (const { el, entry } of this.cells) {
      const matchesTheme = !theme || entry.sprite.theme === theme;
      const matchesSearch =
        !query ||
        entry.sprite.name.toLowerCase().includes(query) ||
        entry.key.toLowerCase().includes(query);
      const show = matchesTheme && matchesSearch;
      el.style.display = show ? "" : "none";
      if (show) count++;
    }
    this.countLabel.textContent = `${count} sprites`;
  }
}
