import {
  getBaseSelectionMode,
  getForceConvex,
  setBaseSelectionMode,
  setForceConvex,
} from "../autotile/TerrainId.js";
import { TERRAIN_PACING, type TerrainPacing, ZOOM_PRESETS } from "./PresentationSettings.js";
import type { RendererMode, RenderHost } from "./RenderHost.js";

const PANEL_STYLE = `
  position: fixed; top: 8px; right: 8px;
  background: rgba(0,0,0,0.75); color: #fff;
  font: 13px monospace; padding: 8px 12px;
  border-radius: 4px; z-index: 100;
  display: none; user-select: none;
  max-width: calc(100vw - 40px); max-height: calc(100dvh - 32px); overflow: auto;
`;

const ROW_STYLE = "margin: 4px 0; display: flex; align-items: center; gap: 6px;";

export class DebugPanel {
  private readonly container: HTMLDivElement;
  private readonly playerInfoEl: HTMLDivElement;
  private readonly zoomPreset: HTMLSelectElement;
  private readonly terrainPacingSelect: HTMLSelectElement;
  private readonly zoomSlider: HTMLInputElement;
  private readonly zoomLabel: HTMLSpanElement;
  private readonly noclipCheckbox: HTMLInputElement;
  private readonly observerCheckbox: HTMLInputElement;
  private readonly baseModeBtn: HTMLButtonElement;
  private readonly convexCheckbox: HTMLInputElement;
  private readonly pauseCheckbox: HTMLInputElement;
  private readonly show3dCheckbox: HTMLInputElement;
  private pendingBaseMode = false;
  private pendingConvex = false;

  constructor() {
    this.container = document.createElement("div");
    this.container.style.cssText = PANEL_STYLE;
    // Focused controls own their keys; selecting a preset must not move the player.
    this.container.addEventListener("keydown", (event) => event.stopPropagation());

    // Player info row (updated externally)
    this.playerInfoEl = document.createElement("div");
    this.playerInfoEl.style.cssText =
      "margin: 4px 0 8px; font-size: 11px; color: #8cf; border-bottom: 1px solid #444; padding-bottom: 6px; word-break: break-all;";
    this.container.appendChild(this.playerInfoEl);

    const presetRow = document.createElement("label");
    presetRow.style.cssText = ROW_STYLE;
    presetRow.append("Zoom preset");
    this.zoomPreset = document.createElement("select");
    this.zoomPreset.setAttribute("aria-label", "Zoom preset");
    this.zoomPreset.add(new Option("Custom", "custom"));
    for (const preset of ZOOM_PRESETS)
      this.zoomPreset.add(new Option(`${preset.key}: ${preset.label}`, String(preset.zoom)));
    this.zoomPreset.value = "1";
    this.zoomPreset.onchange = () => {
      if (this.zoomPreset.value !== "custom") this.setZoom(Number(this.zoomPreset.value));
    };
    presetRow.append(this.zoomPreset);

    const pacingRow = document.createElement("label");
    pacingRow.style.cssText = ROW_STYLE;
    pacingRow.append("Terrain pacing");
    this.terrainPacingSelect = document.createElement("select");
    this.terrainPacingSelect.setAttribute("aria-label", "Terrain pacing");
    for (const [key, policy] of Object.entries(TERRAIN_PACING))
      this.terrainPacingSelect.add(new Option(policy.label, key));
    const pacingHint = document.createElement("div");
    pacingHint.style.cssText = "font-size:11px;color:#ccc;max-width:280px";
    pacingHint.textContent = TERRAIN_PACING.throughput.hint;
    this.terrainPacingSelect.onchange = () => {
      pacingHint.textContent = TERRAIN_PACING[this.terrainPacing].hint;
    };
    pacingRow.append(this.terrainPacingSelect);

    // Zoom slider
    const zoomRow = document.createElement("div");
    zoomRow.style.cssText = ROW_STYLE;
    const zoomLbl = document.createElement("label");
    zoomLbl.textContent = "Zoom";
    this.zoomSlider = document.createElement("input");
    this.zoomSlider.type = "range";
    this.zoomSlider.setAttribute("aria-label", "Zoom");
    this.zoomSlider.min = "0.05";
    this.zoomSlider.max = "3";
    this.zoomSlider.step = "0.05";
    this.zoomSlider.value = "1";
    this.zoomSlider.style.width = "120px";
    this.zoomLabel = document.createElement("span");
    this.zoomLabel.textContent = "1.0x";
    this.zoomSlider.addEventListener("input", () => {
      this.setZoom(parseFloat(this.zoomSlider.value));
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

    // 3D debug view checkbox
    const show3dRow = document.createElement("div");
    show3dRow.style.cssText = ROW_STYLE;
    const show3dLbl = document.createElement("label");
    show3dLbl.textContent = "3D View";
    this.show3dCheckbox = document.createElement("input");
    this.show3dCheckbox.type = "checkbox";
    const show3dHint = document.createElement("span");
    show3dHint.textContent = "split-screen";
    show3dHint.style.cssText = "color: #999; font-size: 11px;";
    show3dRow.append(show3dLbl, this.show3dCheckbox, show3dHint);

    this.container.append(
      presetRow,
      zoomRow,
      pacingRow,
      pacingHint,
      observerRow,
      noclipRow,
      pauseRow,
      show3dRow,
      baseModeRow,
      convexRow,
    );
    document.body.appendChild(this.container);
  }

  setRendererControl(control: NonNullable<RenderHost["rendererControl"]>): void {
    const row = document.createElement("label");
    row.style.cssText = ROW_STYLE;
    row.append("Renderer");
    const select = document.createElement("select");
    select.setAttribute("aria-label", "Renderer");
    for (const [value, label] of [
      ["canvas", "Canvas (default)"],
      ["gpu", "GPU sprites (experimental)"],
      ["gpu-mesh", "GPU + 3D car (experimental)"],
    ] as const) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      select.append(option);
    }
    select.value = control.mode;
    const status = document.createElement("div");
    status.setAttribute("role", "status");
    status.style.cssText = "font-size:11px;color:#ccc;max-width:280px";
    status.textContent = "Switches live. 3D car artwork is unfinished.";
    select.onchange = async () => {
      const requested = select.value as RendererMode;
      select.disabled = true;
      status.textContent = "Switching renderer…";
      try {
        const actual = await control.select(requested);
        select.value = actual;
        status.textContent =
          actual !== requested
            ? "GPU unavailable; using Canvas."
            : "Switched live. 3D car artwork is unfinished.";
      } catch (error) {
        select.value = control.mode;
        status.textContent = `Renderer change failed: ${String(error)}`;
      } finally {
        select.disabled = false;
      }
    };
    row.append(select);
    this.container.append(row, status);
  }

  destroy(): void {
    this.container.remove();
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

  get terrainPacing(): TerrainPacing {
    return this.terrainPacingSelect.value as TerrainPacing;
  }

  setTerrainPacing(value: TerrainPacing): void {
    this.terrainPacingSelect.value = value;
    this.terrainPacingSelect.dispatchEvent(new Event("change"));
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

  get show3d(): boolean {
    return this.show3dCheckbox.checked;
  }

  set show3d(value: boolean) {
    this.show3dCheckbox.checked = value;
  }

  onShow3dChange(cb: (checked: boolean) => void): void {
    this.show3dCheckbox.addEventListener("change", () => cb(this.show3dCheckbox.checked));
  }

  setZoom(value: number): void {
    this.zoomSlider.value = String(value);
    const actual = this.zoom;
    this.zoomLabel.textContent = `${actual.toFixed(2)}x`;
    this.zoomPreset.value = ZOOM_PRESETS.some((p) => p.zoom === actual) ? String(actual) : "custom";
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
