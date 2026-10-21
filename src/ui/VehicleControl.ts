import { isBoat } from "../boats/Boat.js";
import type { ClientStateView } from "../client/ClientStateView.js";
import { actionHint, inputHint } from "../input/InputHints.js";
import type { TouchMovementMode } from "../input/TapMovement.js";
import { nearestStationBench } from "../railway/StationBench.js";
import { isTrain } from "../railway/Train.js";
import type { CarDrivingStyle } from "../traffic/CarControls.js";
import {
  hasUnsecuredTransportLoad,
  isTransporter,
  supportingTransporter,
  type TransporterAction,
  transportCandidate,
  transporterLocal,
} from "../traffic/CarTransporter.js";
import { boardingDistance, isDrivable, occupiedVehicle } from "../traffic/Driving.js";
import { isTowTruck, towCandidate } from "../traffic/Towing.js";
import { bedDriveLocked, hasVehicleBed } from "../traffic/VehicleBed.js";
import {
  bedContents,
  nearbyCargo,
  onBedFloor,
  type VehicleBedAction,
} from "../traffic/VehicleCargo.js";
import { ContextActions } from "./ContextActions.js";

type VehicleRequest =
  | { type: "vehicle-transporter-action"; entityId: number; action: TransporterAction }
  | { type: "vehicle-tow-action"; entityId: number; action: "attach" | "release" }
  | { type: "vehicle-bed-action"; entityId: number; action: VehicleBedAction }
  | { type: "enter-vehicle"; entityId: number }
  | { type: "exit-vehicle" }
  | { type: "call-train"; benchId: number };
export class VehicleControl {
  readonly root = document.createElement("div");
  readonly button = document.createElement("button");
  private status = document.createElement("p");
  private request: VehicleRequest | null = null;
  private busy = false;
  private error = false;
  private targetKey = "";
  private bedActions = document.createElement("div");
  private bedButtons = new Map<VehicleBedAction, HTMLButtonElement>();
  private transportButtons = new Map<TransporterAction, HTMLButtonElement>();
  private towButtons = new Map<"attach" | "release", HTMLButtonElement>();
  private actions: ContextActions;
  get actionsOpen(): boolean {
    return this.actions.open;
  }
  openActions(): boolean {
    return this.actions.toggle();
  }
  constructor(
    private send: (request: VehicleRequest) => Promise<unknown>,
    changed?: () => void,
  ) {
    this.root.style.cssText =
      "position:fixed;bottom:calc(196px + env(safe-area-inset-bottom));left:16px;z-index:80;max-width:min(360px,calc(100vw - 212px));text-align:left;color:white;font:15px sans-serif";
    this.button.style.cssText =
      "font:inherit;padding:12px 18px;min-height:48px;border-radius:8px;border:1px solid #c5d3b6;color:white;background:#243a32;cursor:pointer";
    this.button.style.cssText +=
      ";position:fixed;right:20px;bottom:calc(274px + env(safe-area-inset-bottom));width:64px;min-height:52px;padding:4px;font-size:13px;border-radius:14px";
    this.root.dataset.vehicleControl = "";
    this.button.onclick = () => this.activate();
    this.status.setAttribute("role", "status");
    this.status.style.cssText = "background:#243a32;border-radius:6px;margin:4px 0;padding:4px";
    // Keep the button anchored while the first touch replaces keyboard hints
    // or an authority error wraps the status onto another line.
    this.bedActions.style.cssText = "display:flex;gap:6px;flex-wrap:wrap;margin-top:6px";
    for (const [action, label] of [
      ["board", "Ride in bed"],
      ["leave", "Climb out"],
      ["load", "Load cargo"],
      ["unload", "Unload cargo"],
      ["tip", "Tip bed"],
      ["lower", "Lower bed"],
    ] as const) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.style.cssText =
        "font:inherit;padding:12px;min-height:48px;border-radius:8px;border:1px solid #c5d3b6;background:#345246;color:white;cursor:pointer";
      button.dataset.bedAction = action;
      this.bedButtons.set(action, button);
      this.bedActions.append(button);
    }
    for (const [action, label] of [
      ["attach", "Attach car"],
      ["release", "Release car"],
    ] as const) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.style.cssText =
        "font:inherit;padding:12px;min-height:48px;border-radius:8px;border:1px solid #c5d3b6;background:#345246;color:white;cursor:pointer";
      button.dataset.towAction = action;
      this.towButtons.set(action, button);
      this.bedActions.append(button);
    }
    for (const [action, label] of [
      ["deploy", "Deploy ramp"],
      ["stow", "Stow ramp"],
      ["secure", "Secure car"],
      ["release", "Release car"],
    ] as const) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.style.cssText =
        "font:inherit;padding:12px;min-height:48px;border-radius:8px;border:1px solid #c5d3b6;background:#345246;color:white;cursor:pointer";
      button.dataset.transporterAction = action;
      this.transportButtons.set(action, button);
      this.bedActions.append(button);
    }
    this.root.append(this.status, this.button);
    this.actions = new ContextActions(this.bedActions, changed);
    this.root.hidden = true;
    document.body.append(this.root);
  }
  update(
    view: ClientStateView,
    allowed: boolean,
    locked: boolean,
    movementMode: TouchMovementMode = "joystick",
    carDriving: CarDrivingStyle = "direction",
  ): boolean {
    const p = view.playerEntity,
      entities = view.entities;
    const current = occupiedVehicle(p, entities);
    const transporters = entities.filter(isTransporter);
    const onDeckPriority = (e: typeof p) => {
      const support = supportingTransporter(e, transporters);
      return support && transporterLocal(support.truck, p.position).x < 0 ? -1 : 0;
    };
    const candidate =
      current ??
      entities
        .filter(
          (e) =>
            isDrivable(e) &&
            e.towedBy === undefined &&
            e.transportedBy === undefined &&
            !entities.some((other) => other.parentId === e.id) &&
            Math.hypot(e.velocity?.vx ?? 0, e.velocity?.vy ?? 0) <= 3 &&
            Math.abs((e.wz ?? 0) - (p.wz ?? 0)) <=
              (supportingTransporter(e, transporters) ? 32 : 12) &&
            boardingDistance(p, e) <= 32,
        )
        .sort(
          (a, b) =>
            onDeckPriority(a) - onDeckPriority(b) ||
            boardingDistance(p, a) - boardingDistance(p, b) ||
            a.id - b.id,
        )[0];
    const bench = !candidate ? nearestStationBench(p, view.props) : undefined;
    let bed =
      allowed && !view.editorEnabled
        ? entities
            .filter(
              (e) =>
                hasVehicleBed(e) &&
                boardingDistance(p, e) <= 32 &&
                Math.hypot(e.velocity?.vx ?? 0, e.velocity?.vy ?? 0) <= 0.5 &&
                (p.parentId === undefined || current?.id === e.id) &&
                p.jumpVZ === undefined &&
                Math.abs((e.wz ?? 0) - (p.wz ?? 0)) <= 112,
            )
            .sort((a, b) => boardingDistance(p, a) - boardingDistance(p, b) || a.id - b.id)[0]
        : undefined;
    let tow =
      allowed && !view.editorEnabled
        ? entities
            .filter(
              (e) =>
                isTowTruck(e) &&
                boardingDistance(p, e) <= 32 &&
                Math.hypot(e.velocity?.vx ?? 0, e.velocity?.vy ?? 0) <= 0.5 &&
                (p.parentId === undefined || current?.id === e.id) &&
                p.jumpVZ === undefined &&
                Math.abs((e.wz ?? 0) - (p.wz ?? 0)) <= 12 &&
                !entities.some((other) => other.parentId === e.id && other.id !== p.id),
            )
            .sort((a, b) => boardingDistance(p, a) - boardingDistance(p, b) || a.id - b.id)[0]
        : undefined;
    // One identified equipment target per menu, even between two parked trucks.
    if (bed && tow) {
      if (boardingDistance(p, bed) <= boardingDistance(p, tow)) tow = undefined;
      else bed = undefined;
    }
    let transport =
      allowed && !view.editorEnabled
        ? entities
            .filter(
              (e) =>
                isTransporter(e) &&
                boardingDistance(p, e) <= 32 &&
                Math.hypot(e.velocity?.vx ?? 0, e.velocity?.vy ?? 0) <= 0.5 &&
                (p.parentId === undefined || current?.id === e.id) &&
                p.jumpVZ === undefined &&
                Math.abs((e.wz ?? 0) - (p.wz ?? 0)) <= 12 &&
                !entities.some((other) => other.parentId === e.id && other.id !== p.id),
            )
            .sort((a, b) => boardingDistance(p, a) - boardingDistance(p, b) || a.id - b.id)[0]
        : undefined;
    if (transport) {
      const other = tow ?? bed;
      if (other && boardingDistance(p, other) < boardingDistance(p, transport))
        transport = undefined;
      else {
        tow = undefined;
        bed = undefined;
      }
    }
    const readyLoad =
      transport &&
      transportCandidate(
        transport,
        entities.filter((e) => !entities.some((other) => other.parentId === e.id)),
      );
    for (const [action, button] of this.transportButtons) {
      button.hidden =
        !transport ||
        (action === "deploy"
          ? transport.vehicleRamp === 1
          : action === "stow"
            ? transport.vehicleRamp !== 1
            : action === "secure"
              ? transport.transportLoadId !== undefined
              : transport.transportLoadId === undefined);
      button.style.display = button.hidden ? "none" : "";
      button.disabled =
        this.busy ||
        locked ||
        (action === "secure" && !readyLoad) ||
        (action === "stow" && !!transport && hasUnsecuredTransportLoad(transport, entities)) ||
        (action === "release" && transport?.vehicleRamp !== 1);
      button.onclick = () => {
        this.actions.close();
        if (transport)
          this.activateRequest({
            type: "vehicle-transporter-action",
            entityId: transport.id,
            action,
          });
      };
    }
    const readyCar =
      tow &&
      towCandidate(
        tow,
        entities.filter((e) => !entities.some((other) => other.parentId === e.id)),
      );
    for (const [action, button] of this.towButtons) {
      button.hidden =
        !tow ||
        (action === "attach" ? tow.towTargetId !== undefined : tow.towTargetId === undefined);
      button.style.display = button.hidden ? "none" : "";
      button.disabled = this.busy || locked || (action === "attach" && !readyCar);
      button.onclick = () => {
        this.actions.close();
        if (tow) this.activateRequest({ type: "vehicle-tow-action", entityId: tow.id, action });
      };
    }
    const inside = bed && onBedFloor(p, bed);
    for (const [action, button] of this.bedButtons) {
      button.hidden =
        !bed ||
        ((action === "tip" || action === "lower") &&
          entities.some((other) => other.parentId === bed.id && other.id !== p.id)) ||
        (action !== "tip" && action !== "lower" && (bedDriveLocked(bed) || !!current)) ||
        (action === "tip"
          ? (bed.vehicleBedTarget ?? 0) > 0
          : action === "lower"
            ? !bedDriveLocked(bed)
            : action === "board"
              ? !!inside
              : action === "leave"
                ? !inside
                : action === "load"
                  ? !nearbyCargo(p, bed, entities).length
                  : !bedContents(bed, entities).length);
      button.disabled = this.busy || locked;
      button.style.display = button.hidden ? "none" : "";
      button.onclick = () => {
        this.actions.close();
        if (bed) this.activateRequest({ type: "vehicle-bed-action", entityId: bed.id, action });
      };
    }
    const key = current
      ? `inside:${current.id}`
      : candidate
        ? `near:${candidate.id}`
        : bench
          ? `bench:${bench.id}`
          : "";
    if (key !== this.targetKey) {
      this.status.textContent = "";
      this.error = false;
      this.targetKey = key;
    }
    this.request =
      allowed && !view.editorEnabled
        ? current
          ? { type: "exit-vehicle" }
          : candidate
            ? { type: "enter-vehicle", entityId: candidate.id }
            : bench
              ? { type: "call-train", benchId: bench.id }
              : bed && inside
                ? { type: "vehicle-bed-action", entityId: bed.id, action: "leave" }
                : null
        : null;
    this.root.hidden = !this.request && !bed && !tow && !transport;
    this.button.hidden = !this.request || this.request.type === "vehicle-bed-action";
    this.button.style.display = this.button.hidden ? "none" : "";
    this.button.disabled = this.busy || locked;
    const action = current
      ? "Get out"
      : candidate && isTrain(candidate)
        ? "Drive train"
        : candidate && isBoat(candidate)
          ? "Drive boat"
          : bench
            ? "Call train"
            : candidate && isTransporter(candidate)
              ? "Drive transporter"
              : "Drive car";
    const hint = actionHint("enter_place");
    const label = `${action}${hint ? ` · ${hint}` : ""}`;
    if (this.button.textContent !== label) this.button.textContent = label;
    if (current && !this.busy && !this.error) {
      const hint = isTrain(current)
        ? inputHint("W/S or arrows to drive train", "Left stick ↑/↓ to drive train") ||
          (movementMode === "hold"
            ? "Hold left / right to travel · lift to stop"
            : movementMode === "tap"
              ? "Tap left / right to travel · tap again to stop"
              : "Drag left / right to drive train")
        : (carDriving === "steering"
            ? inputHint("↑/↓ Forward/Reverse · ←/→ Steer", "Stick ↑/↓ Forward/Reverse · ←/→ Steer")
            : inputHint(
                "WASD / arrows · aim behind to reverse",
                "Left stick · aim behind to reverse",
              )) ||
          (movementMode === "hold"
            ? "Hold a direction · aim behind to reverse"
            : movementMode === "tap"
              ? "Tap a destination · tap behind to reverse"
              : carDriving === "steering"
                ? "Joystick ↑/↓ Forward/Reverse · ←/→ Steer"
                : "Drag a direction · aim behind to reverse");
      if (this.status.textContent !== hint) this.status.textContent = hint;
    }
    if (tow && !this.busy && !this.error && !readyCar && tow.towTargetId === undefined)
      this.status.textContent = "Back up to a parked car’s front wheels to attach it.";
    if (transport && !this.busy && !this.error)
      this.status.textContent =
        transport.transportLoadId !== undefined
          ? "Car secured. Stow the ramp before driving; deploy it to unload."
          : "Deploy ramp, drive a car onto the deck, get out, then secure it.";
    const equipment = transport ?? tow ?? bed;
    this.actions.update(
      transport ? "Transporter actions" : tow ? "Tow truck actions" : "Truck bed actions",
      equipment ? `${equipment.id}:${p.parentId ?? "outside"}` : "",
      !!equipment &&
        [
          ...this.bedButtons.values(),
          ...this.towButtons.values(),
          ...this.transportButtons.values(),
        ].some((b) => !b.hidden),
      locked || this.busy,
    );
    return !!this.request || !!bed || !!tow || !!transport;
  }
  activate(): boolean {
    if (!this.request) return false;
    return this.activateRequest(this.request);
  }
  private activateRequest(request: VehicleRequest): boolean {
    if (this.busy || this.button.disabled) return true;
    this.busy = true;
    this.status.textContent = "";
    this.error = false;
    const targetKey = this.targetKey;
    void this.send(request)
      .then(() => {
        if (request.type === "call-train" && this.targetKey === targetKey)
          this.status.textContent = "Poof! Your train is here.";
      })
      .catch((error) => {
        if (this.targetKey !== targetKey) return;
        this.error = true;
        this.status.textContent = String(error);
      })
      .finally(() => {
        this.busy = false;
      });
    return true;
  }
  mountEmbedded(container: HTMLElement): void {
    this.root.style.position = "absolute";
    this.root.style.bottom = "24px";
    this.root.style.maxWidth = "min(360px,calc(100% - 180px))";
    this.button.style.position = "absolute";
    this.button.style.bottom = "24px";
    this.actions.button.style.position = "absolute";
    this.actions.button.style.bottom = "90px";
    container.append(this.root, this.button, this.actions.button);
  }
  destroy(): void {
    this.actions.destroy();
    this.button.remove();
    this.root.remove();
  }
}
