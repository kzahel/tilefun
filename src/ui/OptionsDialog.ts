import {
  DEFAULT_VIEW_DISTANCE,
  type FirstPersonViewDistance,
  viewDistance,
} from "../config/firstPersonViewDistance.js";
import { keyLabel } from "../input/KeyLabels.js";
import type { TouchMovementMode } from "../input/TapMovement.js";
import { type CarDrivingStyle, DEFAULT_CAR_DRIVING } from "../traffic/CarControls.js";
import { activateMenu, deactivateMenu } from "./MenuNavigation.js";
import "./OptionsDialog.css";

export class OptionsDialog {
  private dialog = document.createElement("dialog");
  private opener: HTMLElement | null = null;
  private cards: HTMLButtonElement[] = [];
  private help = document.createElement("p");
  private status = document.createElement("p");
  private pinch = document.createElement("input");
  private saving = false;
  private carStyle = document.createElement("select");
  private firstPerson = document.createElement("input");
  private firstPersonHelp = document.createElement("p");
  private distance = document.createElement("select");
  private controls = document.createElement("p");
  constructor(
    private select: (mode: TouchMovementMode) => Promise<void>,
    private closed: () => void,
    private selectPinch: (enabled: boolean) => Promise<void>,
    private selectCar: (style: CarDrivingStyle) => Promise<void>,
    private selectFirstPerson: (enabled: boolean) => Promise<void>,
    private selectDistance: (distance: FirstPersonViewDistance) => Promise<void>,
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
      ["hold", "👇 Hold to move"],
      ["joystick", "🕹 Joystick"],
    ] as const) {
      const card = this.button(text, () => {
        void this.choose(mode);
      });
      card.dataset.mode = mode;
      card.setAttribute("aria-label", text.slice(text.indexOf(" ") + 1));
      this.cards.push(card);
      choices.append(card);
    }
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
    const driving = document.createElement("label");
    driving.className = "options-driving";
    driving.append("Car controls ", this.carStyle);
    this.carStyle.setAttribute("aria-label", "Car controls");
    this.carStyle.setAttribute("aria-describedby", "options-driving-help");
    for (const [value, text] of [
      ["direction", "Point where to drive"],
      ["steering", "Forward / reverse and steer"],
    ] as const) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = text;
      this.carStyle.append(option);
    }
    this.carStyle.onchange = () => {
      void this.chooseCar();
    };
    const view = document.createElement("label");
    view.className = "options-pinch";
    this.firstPerson.type = "checkbox";
    this.firstPerson.setAttribute("aria-describedby", "options-view-help");
    this.firstPerson.onchange = () => {
      void this.chooseFirstPerson();
    };
    view.append(this.firstPerson, "First-person view (experiment)");
    this.firstPersonHelp.id = "options-view-help";
    const distance = document.createElement("label");
    distance.className = "options-driving";
    distance.append("First-person view distance ", this.distance);
    this.distance.setAttribute("aria-label", "First-person view distance");
    for (const [value, text] of [
      ["near", "Near (fastest)"],
      ["medium", "Medium"],
      ["far", "Far (loads more world)"],
    ] as const) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = text;
      this.distance.append(option);
    }
    this.distance.onchange = () => {
      void this.chooseDistance();
    };
    const drivingHelp = document.createElement("p");
    drivingHelp.id = "options-driving-help";
    drivingHelp.textContent =
      "Point behind to reverse. Steering: ↑ forward, ↓ reverse, ←/→ steer. Taps always aim.";
    this.status.setAttribute("role", "status");
    this.status.className = "options-status";
    const back = this.button("Back to game", () => this.hide());
    back.className = "options-back";
    d.append(
      header,
      heading,
      choices,
      this.help,
      driving,
      drivingHelp,
      zoom,
      pinchHelp,
      view,
      this.firstPersonHelp,
      distance,
      this.status,
      back,
    );
    const controlHelp = document.createElement("details");
    const controlSummary = document.createElement("summary");
    controlSummary.textContent = "Controller controls";
    controlHelp.append(controlSummary, this.controls);
    d.append(controlHelp);
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
  show(
    mode: TouchMovementMode,
    opener: HTMLElement | null,
    pinchZoom: boolean,
    carDriving: CarDrivingStyle = DEFAULT_CAR_DRIVING,
    firstPerson = false,
    distance: FirstPersonViewDistance = DEFAULT_VIEW_DISTANCE,
  ): void {
    this.opener = opener;
    this.status.textContent = "";
    this.setMode(mode);
    this.pinch.checked = pinchZoom;
    this.carStyle.value = carDriving;
    this.firstPerson.checked = firstPerson;
    this.distance.value = distance;
    // Key labels follow the player's layout, which may be learned during play.
    const k = keyLabel;
    this.firstPersonHelp.textContent = `Look by clicking the world, then moving the mouse, or with the right stick. ${k("KeyV")} switches it until you reload; this box is the saved choice.`;
    this.controls.textContent = `A / ${k("Space")} Jump · X / ${k("KeyB")} Throw · Y / ${k("KeyE")} Interact · RT / Shift Fast · RB / ${k("KeyH")} Horn · D-pad ↑ / ${k("KeyL")} Lights · D-pad → / ${k("KeyK")} Siren style. LB / Tab Build–Play · View / ${k("KeyG")} Map · Menu / Escape Pause. Right stick moves the cursor over the world and tools (in first person it looks around); A or RT selects. In menus: A Select · B Back. While building: RT Paint · LT Erase · Y Tools.`;
    if (!this.visible) this.dialog.showModal();
    activateMenu(this.dialog, () => this.hide(), false);
    this.cards.find((c) => c.dataset.mode === mode)?.focus();
  }
  hide(): void {
    if (!this.visible) return;
    deactivateMenu(this.dialog);
    this.dialog.close();
    this.closed();
    this.opener?.focus();
  }
  destroy(): void {
    document.removeEventListener("fullscreenchange", this.fullscreen);
    deactivateMenu(this.dialog);
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
    this.help.textContent = {
      tap: "Tap a place to walk there. Tap near your feet to stop.",
      hold: "Hold a finger where you want to go. Lift to stop. The newest finger steers.",
      joystick: "Hold and drag the joystick to move. Lift to stop.",
    }[mode];
    for (const c of this.cards) c.setAttribute("aria-pressed", String(c.dataset.mode === mode));
  }
  /** Saves one choice with every control disabled meanwhile, then reports and refocuses. */
  private async save(
    action: () => Promise<void>,
    saved: string,
    focus: () => HTMLElement | undefined,
  ): Promise<void> {
    if (this.saving) return;
    this.saving = true;
    const controls = [...this.cards, this.pinch, this.carStyle, this.firstPerson, this.distance];
    for (const c of controls) c.disabled = true;
    try {
      await action();
      this.status.textContent = saved;
    } catch {
      this.status.textContent = "You can use this choice now, but it could not be remembered.";
    } finally {
      this.saving = false;
      for (const c of controls) c.disabled = false;
      if (this.visible) focus()?.focus();
    }
  }
  private async choose(mode: TouchMovementMode): Promise<void> {
    if (this.saving) return;
    this.setMode(mode);
    await this.save(
      () => this.select(mode),
      "Movement saved for this player.",
      () => this.cards.find((c) => c.dataset.mode === mode),
    );
  }
  private choosePinch(): Promise<void> {
    return this.save(
      () => this.selectPinch(this.pinch.checked),
      "Zoom preference saved for this player.",
      () => this.pinch,
    );
  }
  private chooseFirstPerson(): Promise<void> {
    return this.save(
      () => this.selectFirstPerson(this.firstPerson.checked),
      "View saved for this player.",
      () => this.firstPerson,
    );
  }
  private chooseDistance(): Promise<void> {
    return this.save(
      () => this.selectDistance(viewDistance(this.distance.value)),
      "View distance saved for this player.",
      () => this.distance,
    );
  }
  private chooseCar(): Promise<void> {
    return this.save(
      () => this.selectCar(this.carStyle.value as CarDrivingStyle),
      "Car controls saved for this player.",
      () => this.carStyle,
    );
  }
  private fullscreen = (): void => {
    if (this.visible) {
      this.dialog.close();
      this.dialog.showModal();
    }
  };
}
