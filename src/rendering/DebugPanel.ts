import { getBaseSelectionMode, setBaseSelectionMode } from "../autotile/TerrainId.js";

const PANEL_STYLE = `
  position: fixed; top: 8px; right: 8px;
  background: rgba(0,0,0,0.75); color: #fff;
  font: 13px monospace; padding: 8px 12px;
  border-radius: 4px; z-index: 100;
  display: none; user-select: none;
`;

const ROW_STYLE = "margin: 4px 0; display: flex; align-items: center; gap: 6px;";

export class DebugPanel {
  private readonly container: HTMLDivElement;
  private readonly zoomSlider: HTMLInputElement;
  private readonly zoomLabel: HTMLSpanElement;
  private readonly noclipCheckbox: HTMLInputElement;
  private readonly observerCheckbox: HTMLInputElement;
  private readonly seedInput: HTMLInputElement;
  private readonly strategySelect: HTMLSelectElement;
  private readonly baseModeBtn: HTMLButtonElement;
  private pendingSeed: string | null = null;
  private pendingStrategy: string | null = null;
  private pendingBaseMode = false;

  constructor(defaultSeed: string) {
    this.container = document.createElement("div");
    this.container.style.cssText = PANEL_STYLE;

    // Zoom slider
    const zoomRow = document.createElement("div");
    zoomRow.style.cssText = ROW_STYLE;
    const zoomLbl = document.createElement("label");
    zoomLbl.textContent = "Zoom";
    this.zoomSlider = document.createElement("input");
    this.zoomSlider.type = "range";
    this.zoomSlider.min = "0.05";
    this.zoomSlider.max = "3";
    this.zoomSlider.step = "0.05";
    this.zoomSlider.value = "1";
    this.zoomSlider.style.width = "120px";
    this.zoomLabel = document.createElement("span");
    this.zoomLabel.textContent = "1.0x";
    this.zoomSlider.addEventListener("input", () => {
      this.zoomLabel.textContent = `${parseFloat(this.zoomSlider.value).toFixed(2)}x`;
    });
    zoomRow.append(zoomLbl, this.zoomSlider, this.zoomLabel);

    // Observer checkbox (load chunks at 1x zoom)
    const observerRow = document.createElement("div");
    observerRow.style.cssText = ROW_STYLE;
    const observerLbl = document.createElement("label");
    observerLbl.textContent = "Observer";
    this.observerCheckbox = document.createElement("input");
    this.observerCheckbox.type = "checkbox";
    const observerHint = document.createElement("span");
    observerHint.textContent = "load at 1x";
    observerHint.style.cssText = "color: #999; font-size: 11px;";
    observerRow.append(observerLbl, this.observerCheckbox, observerHint);

    // Noclip checkbox
    const noclipRow = document.createElement("div");
    noclipRow.style.cssText = ROW_STYLE;
    const noclipLbl = document.createElement("label");
    noclipLbl.textContent = "Noclip";
    this.noclipCheckbox = document.createElement("input");
    this.noclipCheckbox.type = "checkbox";
    noclipRow.append(noclipLbl, this.noclipCheckbox);

    // Seed input + regen button
    const seedRow = document.createElement("div");
    seedRow.style.cssText = ROW_STYLE;
    const seedLbl = document.createElement("label");
    seedLbl.textContent = "Seed";
    this.seedInput = document.createElement("input");
    this.seedInput.type = "text";
    this.seedInput.value = defaultSeed;
    this.seedInput.style.cssText =
      "width: 100px; font: 12px monospace; background: #333; color: #fff; border: 1px solid #666; padding: 2px 4px;";
    const regenBtn = document.createElement("button");
    regenBtn.textContent = "Regen";
    regenBtn.style.cssText = "font: 12px monospace; padding: 2px 8px; cursor: pointer;";
    regenBtn.addEventListener("click", () => {
      this.pendingSeed = this.seedInput.value;
    });
    const randomBtn = document.createElement("button");
    randomBtn.textContent = "Random";
    randomBtn.style.cssText = "font: 12px monospace; padding: 2px 8px; cursor: pointer;";
    randomBtn.addEventListener("click", () => {
      const seed = Math.random().toString(36).slice(2, 10);
      this.seedInput.value = seed;
      this.pendingSeed = seed;
    });
    seedRow.append(seedLbl, this.seedInput, regenBtn, randomBtn);

    // Strategy selector
    const strategyRow = document.createElement("div");
    strategyRow.style.cssText = ROW_STYLE;
    const strategyLbl = document.createElement("label");
    strategyLbl.textContent = "Strategy";
    this.strategySelect = document.createElement("select");
    this.strategySelect.style.cssText =
      "font: 12px monospace; background: #333; color: #fff; border: 1px solid #666; padding: 2px 4px;";
    const onionOpt = document.createElement("option");
    onionOpt.value = "onion";
    onionOpt.textContent = "Onion";
    this.strategySelect.appendChild(onionOpt);
    this.strategySelect.addEventListener("change", () => {
      this.pendingStrategy = this.strategySelect.value;
    });
    strategyRow.append(strategyLbl, this.strategySelect);

    // Base selection mode toggle
    const baseModeRow = document.createElement("div");
    baseModeRow.style.cssText = ROW_STYLE;
    const baseModeLbl = document.createElement("label");
    baseModeLbl.textContent = "Base";
    this.baseModeBtn = document.createElement("button");
    this.baseModeBtn.textContent = getBaseSelectionMode();
    this.baseModeBtn.style.cssText = "font: 12px monospace; padding: 2px 8px; cursor: pointer;";
    this.baseModeBtn.addEventListener("click", () => this.toggleBaseMode());
    const baseModeHint = document.createElement("span");
    baseModeHint.textContent = "tile base pick";
    baseModeHint.style.cssText = "color: #999; font-size: 11px;";
    baseModeRow.append(baseModeLbl, this.baseModeBtn, baseModeHint);

    this.container.append(zoomRow, observerRow, noclipRow, seedRow, strategyRow, baseModeRow);
    document.body.appendChild(this.container);
  }

  get visible(): boolean {
    return this.container.style.display !== "none";
  }

  set visible(v: boolean) {
    this.container.style.display = v ? "block" : "none";
  }

  get zoom(): number {
    return parseFloat(this.zoomSlider.value);
  }

  get noclip(): boolean {
    return this.noclipCheckbox.checked;
  }

  get observer(): boolean {
    return this.observerCheckbox.checked;
  }

  get strategy(): string {
    return this.strategySelect.value;
  }

  /** Returns new seed if regen was requested, then clears the request. */
  consumeSeedChange(): string | null {
    const s = this.pendingSeed;
    this.pendingSeed = null;
    return s;
  }

  /** Returns new strategy if changed, then clears the request. */
  consumeStrategyChange(): string | null {
    const s = this.pendingStrategy;
    this.pendingStrategy = null;
    return s;
  }

  /** Returns true if base selection mode was toggled, then clears the flag. */
  consumeBaseModeChange(): boolean {
    const changed = this.pendingBaseMode;
    this.pendingBaseMode = false;
    return changed;
  }

  /** Toggle base selection mode (called by keyboard shortcut or button). */
  toggleBaseMode(): void {
    setBaseSelectionMode(getBaseSelectionMode() === "depth" ? "nw" : "depth");
    this.baseModeBtn.textContent = getBaseSelectionMode();
    this.pendingBaseMode = true;
  }
}
