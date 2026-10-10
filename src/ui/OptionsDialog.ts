import type { TouchMovementMode } from "../input/TapMovement.js";
import "./OptionsDialog.css";

export class OptionsDialog {
  private dialog = document.createElement("dialog");
  private opener: HTMLElement | null = null;
  private cards: HTMLButtonElement[] = [];
  private status = document.createElement("p");
  private pinch = document.createElement("input");
  private saving = false;
  constructor(
    private select: (mode: TouchMovementMode) => Promise<void>,
    private closed: () => void,
    private selectPinch: (enabled: boolean) => Promise<void>,
  ) {
    const d = this.dialog;
    d.className = "options-dialog";
    d.setAttribute("aria-labelledby", "options-title");
    d.dataset.testid = "options-dialog";
    const header = document.createElement("header");
    const title = document.createElement("h1");
    title.id = "options-title";
    title.textContent = "Options";
    const close = this.button("Close", () => this.hide());
    header.append(title, close);
    const heading = document.createElement("h2");
    heading.textContent = "Movement";
    const choices = document.createElement("div");
    choices.className = "options-choices";
    for (const [mode, text] of [
      ["tap", "☝ Tap to move"],
      ["joystick", "🕹 Joystick"],
    ] as const) {
      const card = this.button(text, () => {
        void this.choose(mode);
      });
      card.dataset.mode = mode;
      card.setAttribute("aria-label", mode === "tap" ? "Tap to move" : "Joystick");
      this.cards.push(card);
      choices.append(card);
    }
    const help = document.createElement("p");
    help.textContent = "Tap a place to walk there. Tap near your feet to stop.";
    const zoom = document.createElement("label");
    zoom.className = "options-pinch";
    this.pinch.type = "checkbox";
    this.pinch.setAttribute("aria-describedby", "options-pinch-help");
    this.pinch.onchange = () => {
      void this.choosePinch();
    };
    zoom.append(this.pinch, "Two-finger pinch to zoom");
    const pinchHelp = document.createElement("p");
    pinchHelp.id = "options-pinch-help";
    pinchHelp.textContent =
      "Put two fingers on the world together, then spread or pinch them. Joystick movement and action buttons block zoom.";
    this.status.setAttribute("role", "status");
    this.status.className = "options-status";
    d.append(
      header,
      heading,
      choices,
      help,
      zoom,
      pinchHelp,
      this.status,
      this.button("Back to game", () => this.hide()),
    );
    d.addEventListener("cancel", (e) => {
      e.preventDefault();
      this.hide();
    });
    d.addEventListener("keydown", (e) => e.stopPropagation());
    d.addEventListener("keyup", (e) => e.stopPropagation());
    document.addEventListener("fullscreenchange", this.fullscreen);
    document.body.append(d);
  }
  get visible(): boolean {
    return this.dialog.open;
  }
  show(mode: TouchMovementMode, opener: HTMLElement | null, pinchZoom: boolean): void {
    this.opener = opener;
    this.status.textContent = "";
    this.setMode(mode);
    this.pinch.checked = pinchZoom;
    if (!this.visible) this.dialog.showModal();
    this.cards.find((c) => c.dataset.mode === mode)?.focus();
  }
  hide(): void {
    if (!this.visible) return;
    this.dialog.close();
    this.closed();
    this.opener?.focus();
  }
  destroy(): void {
    document.removeEventListener("fullscreenchange", this.fullscreen);
    this.dialog.remove();
  }
  private button(text: string, action: () => void): HTMLButtonElement {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = text;
    b.onclick = action;
    return b;
  }
  private setMode(mode: TouchMovementMode): void {
    for (const c of this.cards) c.setAttribute("aria-pressed", String(c.dataset.mode === mode));
  }
  private async choose(mode: TouchMovementMode): Promise<void> {
    if (this.saving) return;
    this.saving = true;
    this.setMode(mode);
    for (const c of this.cards) c.disabled = true;
    this.pinch.disabled = true;
    try {
      await this.select(mode);
      this.status.textContent = "Movement saved for this player.";
    } catch {
      this.status.textContent = "You can use this choice now, but it could not be remembered.";
    } finally {
      this.saving = false;
      for (const c of this.cards) c.disabled = false;
      this.pinch.disabled = false;
      if (this.visible) this.cards.find((c) => c.dataset.mode === mode)?.focus();
    }
  }
  private async choosePinch(): Promise<void> {
    if (this.saving) return;
    this.saving = true;
    this.pinch.disabled = true;
    for (const c of this.cards) c.disabled = true;
    try {
      await this.selectPinch(this.pinch.checked);
      this.status.textContent = "Zoom preference saved for this player.";
    } catch {
      this.status.textContent = "You can use this choice now, but it could not be remembered.";
    } finally {
      this.saving = false;
      this.pinch.disabled = false;
      for (const c of this.cards) c.disabled = false;
      if (this.visible) this.pinch.focus();
    }
  }
  private fullscreen = (): void => {
    if (this.visible) {
      this.dialog.close();
      this.dialog.showModal();
    }
  };
}
