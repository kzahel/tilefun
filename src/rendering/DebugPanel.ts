import {
  getBaseSelectionMode,
  getForceConvex,
  setBaseSelectionMode,
  setForceConvex,
} from "../autotile/TerrainId.js";

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
  private readonly playerInfoEl: HTMLDivElement;
  private readonly zoomSlider: HTMLInputElement;
  private readonly zoomLabel: HTMLSpanElement;
  private readonly noclipCheckbox: HTMLInputElement;
  private readonly observerCheckbox: HTMLInputElement;
  private readonly baseModeBtn: HTMLButtonElement;
  private readonly convexCheckbox: HTMLInputElement;
  private readonly pauseCheckbox: HTMLInputElement;
  private pendingBaseMode = false;
  private pendingConvex = false;

  constructor() {
    this.container = document.createElement("div");
    this.container.style.cssText = PANEL_STYLE;

    // Player info row (updated externally)
    this.playerInfoEl = document.createElement("div");
    this.playerInfoEl.style.cssText =
      "margin: 4px 0 8px; font-size: 11px; color: #8cf; border-bottom: 1px solid #444; padding-bottom: 6px; word-break: break-all;";
    this.container.appendChild(this.playerInfoEl);

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

    // Force convex checkbox
    const convexRow = document.createElement("div");
    convexRow.style.cssText = ROW_STYLE;
    const convexLbl = document.createElement("label");
    convexLbl.textContent = "Convex";
    this.convexCheckbox = document.createElement("input");
    this.convexCheckbox.type = "checkbox";
    this.convexCheckbox.checked = getForceConvex();
    this.convexCheckbox.addEventListener("change", () => {
      setForceConvex(this.convexCheckbox.checked);
      this.pendingConvex = true;
    });
    const convexHint = document.createElement("span");
    convexHint.textContent = "no concave corners";
    convexHint.style.cssText = "color: #999; font-size: 11px;";
    convexRow.append(convexLbl, this.convexCheckbox, convexHint);

    // Pause entities checkbox
    const pauseRow = document.createElement("div");
    pauseRow.style.cssText = ROW_STYLE;
    const pauseLbl = document.createElement("label");
    pauseLbl.textContent = "Pause";
    this.pauseCheckbox = document.createElement("input");
    this.pauseCheckbox.type = "checkbox";
    const pauseHint = document.createElement("span");
    pauseHint.textContent = "freeze entities";
    pauseHint.style.cssText = "color: #999; font-size: 11px;";
    pauseRow.append(pauseLbl, this.pauseCheckbox, pauseHint);

    this.container.append(zoomRow, observerRow, noclipRow, pauseRow, baseModeRow, convexRow);
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

  get paused(): boolean {
    return this.pauseCheckbox.checked;
  }

  setZoom(value: number): void {
    this.zoomSlider.value = String(value);
    this.zoomLabel.textContent = `${value.toFixed(2)}x`;
  }

  setNoclip(value: boolean): void {
    this.noclipCheckbox.checked = value;
  }

  setPaused(value: boolean): void {
    this.pauseCheckbox.checked = value;
  }

  /** Returns true if base selection mode was toggled, then clears the flag. */
  consumeBaseModeChange(): boolean {
    const changed = this.pendingBaseMode;
    this.pendingBaseMode = false;
    return changed;
  }

  /** Returns true if convex mode was toggled, then clears the flag. */
  consumeConvexChange(): boolean {
    const changed = this.pendingConvex;
    this.pendingConvex = false;
    return changed;
  }

  /** Update the player info display. */
  setPlayerInfo(info: {
    clientId: string;
    profileName: string;
    profileId: string;
    entityId: number;
    worldId: string | null;
  }): void {
    const cid = info.clientId.length > 12 ? `${info.clientId.slice(0, 8)}...` : info.clientId;
    const wid =
      info.worldId && info.worldId.length > 12
        ? `${info.worldId.slice(0, 8)}...`
        : (info.worldId ?? "—");
    this.playerInfoEl.innerHTML = `<b>Client:</b> ${cid}<br><b>Profile:</b> ${info.profileName} (${info.profileId.slice(0, 8)}...)<br><b>Entity:</b> ${info.entityId} · <b>Realm:</b> ${wid}`;
  }

  /** Toggle base selection mode (called by keyboard shortcut or button). */
  toggleBaseMode(): void {
    setBaseSelectionMode(getBaseSelectionMode() === "depth" ? "nw" : "depth");
    this.baseModeBtn.textContent = getBaseSelectionMode();
    this.pendingBaseMode = true;
  }
}
