import { MapRenderer } from "../explorer/MapRenderer.js";
import { QueryClient } from "../explorer/QueryClient.js";
import {
  DEFAULT_OVERLAYS,
  screenToWorld,
  type ViewState,
  visibleBounds,
  zoomAt,
} from "../explorer/ViewState.js";
import { descriptorKey } from "../generation/GenerationDescriptor.js";
import type { OverviewResult } from "../generation/Overview.js";
import { type Point, QUERY_LIMITS } from "../generation/regional/RegionalPlanner.js";
import type { WorldMapMessage, WorldMapPlayer } from "../shared/protocol.js";
import { activateMenu, deactivateMenu } from "./MenuNavigation.js";
import "./WorldMap.css";

interface MapActions {
  snapshot(): Promise<WorldMapMessage>;
  travel(map: WorldMapMessage, point: Point): Promise<unknown>;
  close(): void;
}

/** An overlay on the current connection, with bounded terrain work in a worker. */
export class WorldMap {
  private readonly root = document.createElement("div");
  private readonly dialog = document.createElement("section");
  private readonly canvas = document.createElement("canvas");
  private readonly title = document.createElement("h2");
  private readonly status = document.createElement("p");
  private readonly roster = document.createElement("div");
  private readonly depots = document.createElement("div");
  private readonly tracks = document.createElement("div");
  private readonly stops = document.createElement("div");
  private readonly count = document.createElement("span");
  private readonly renderer = new MapRenderer();
  private readonly resize = new ResizeObserver(() => this.resized());
  private readonly rosterButtons = new Map<number, HTMLButtonElement>();
  private map: WorldMapMessage | null = null;
  private result: OverviewResult | null = null;
  private query: QueryClient | null = null;
  private view: ViewState = { x: 0, y: 0, zoom: 1 };
  private width = 1;
  private height = 1;
  private epoch = 0;
  private open = false;
  private busy = false;
  private pollTimer: ReturnType<typeof setTimeout> | undefined;
  private queryTimer: ReturnType<typeof setTimeout> | undefined;
  private holdTimer: ReturnType<typeof setTimeout> | undefined;
  private target: Point | null = null;
  private previousFocus: HTMLElement | null = null;
  private pointers = new Map<number, Point>();
  private nativeTouchEvents = false;
  private gesture: { origin: Point; view: ViewState; dragged: boolean; held: boolean } | null =
    null;
  private pinch: { distance: number; view: ViewState; center: Point } | null = null;

  constructor(private readonly actions: MapActions) {
    this.root.className = "world-map-overlay";
    this.root.hidden = true;
    this.root.setAttribute("data-testid", "world-map");
    this.dialog.className = "world-map-dialog";
    this.dialog.setAttribute("role", "dialog");
    this.dialog.setAttribute("aria-modal", "true");
    this.dialog.setAttribute("aria-label", "World map");
    const header = document.createElement("header");
    this.title.textContent = "World map";
    header.append(
      this.title,
      this.button("Close map", () => actions.close()),
    );
    const toolbar = document.createElement("div");
    toolbar.className = "world-map-toolbar";
    toolbar.append(
      this.button("Find me", () => this.centerSelf()),
      this.button("Zoom in", () => this.zoom(2)),
      this.button("Zoom out", () => this.zoom(0.5)),
      this.button("←", () => this.panController(-1, 0)),
      this.button("↑", () => this.panController(0, -1)),
      this.button("↓", () => this.panController(0, 1)),
      this.button("→", () => this.panController(1, 0)),
      this.button("Travel to selected point", () => {
        void this.travel(this.target ?? { x: this.view.x, y: this.view.y });
      }),
      this.count,
    );
    this.canvas.setAttribute(
      "aria-label",
      "World map terrain. Drag to pan, pinch or scroll to zoom, hold a location to fast travel.",
    );
    this.canvas.setAttribute("data-testid", "world-map-canvas");
    this.canvas.tabIndex = 0;
    this.canvas.dataset.controllerPoint = "true";
    this.canvas.addEventListener("controller-point", (event) => {
      const point = (event as CustomEvent<Point>).detail;
      const rect = this.canvas.getBoundingClientRect();
      this.selectPoint({ x: point.x - rect.left, y: point.y - rect.top });
    });
    this.status.setAttribute("role", "status");
    this.status.textContent = "Loading your world…";
    const footer = document.createElement("footer");
    const hint = document.createElement("p");
    hint.textContent = "Drag to pan · pinch / scroll to zoom · hold a location to fast travel";
    const note = document.createElement("small");
    note.textContent =
      "Terrain overview · indoor players appear at their entrance · nearby safe ground is chosen for travel";
    this.roster.className = "world-map-roster";
    this.roster.setAttribute("aria-label", "Players in this world");
    const legend = document.createElement("small");
    legend.textContent = "Purple dashed lines: railways · ◇: train stops";
    this.stops.className = "world-map-roster";
    this.stops.setAttribute("role", "group");
    this.stops.setAttribute("aria-label", "Train stops");
    this.tracks.className = "world-map-roster";
    this.tracks.setAttribute("role", "group");
    this.tracks.setAttribute("aria-label", "Racetracks");
    const trackLegend = document.createElement("small");
    trackLegend.textContent = "Red ovals / checkered flags: racetracks";
    this.depots.className = "world-map-roster";
    this.depots.setAttribute("role", "group");
    this.depots.setAttribute("aria-label", "Vehicle depots");
    const depotLegend = document.createElement("small");
    depotLegend.textContent = "Orange trucks: vehicle depots · select a depot, then Travel";
    footer.append(
      hint,
      legend,
      this.stops,
      trackLegend,
      this.tracks,
      depotLegend,
      this.depots,
      this.roster,
      this.status,
      note,
    );
    this.dialog.append(header, toolbar, this.canvas, footer);
    this.root.append(this.dialog);
    document.body.append(this.root);
    this.root.addEventListener("keydown", (event) => this.keyDown(event));
    this.root.addEventListener("pointerdown", (event) => {
      if (event.target === this.root && !this.busy) actions.close();
    });
    this.canvas.addEventListener("contextmenu", (event) => event.preventDefault());
    this.canvas.addEventListener("pointerdown", (event) => this.pointerDown(event));
    this.canvas.addEventListener("pointermove", (event) => this.pointerMove(event));
    this.canvas.addEventListener("pointerup", (event) => this.pointerUp(event, false));
    this.canvas.addEventListener("pointercancel", (event) => this.pointerUp(event, true));
    this.canvas.addEventListener("lostpointercapture", (event) => this.pointerUp(event, true));
    // Native touchscreen contacts have their own path. Some device/browser stacks
    // cancel secondary pointer events while still delivering complete touch lists.
    this.canvas.addEventListener("touchstart", this.touchStart, { passive: false });
    this.canvas.addEventListener("touchmove", this.touchMove, { passive: false });
    this.canvas.addEventListener("touchend", this.touchEnd, { passive: false });
    this.canvas.addEventListener("touchcancel", this.touchCancel, { passive: false });
    window.addEventListener("blur", this.resetGesture);
    this.canvas.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault();
        this.cancelHold();
        this.view = this.bounded(
          zoomAt(
            this.view,
            this.width,
            this.height,
            this.point(event),
            Math.exp(-event.deltaY * 0.002),
          ),
        );
        this.changed();
      },
      { passive: false },
    );
    this.resize.observe(this.canvas);
  }

  private button(label: string, click: () => void): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.onclick = click;
    return button;
  }

  show(): void {
    this.open = true;
    this.epoch++;
    this.root.hidden = false;
    this.root.dataset.settled = "false";
    this.status.textContent = "Loading your world…";
    this.previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    activateMenu(this.root, () => this.actions.close());
    this.resized();
    void this.refresh(this.epoch);
  }

  hide(): void {
    deactivateMenu(this.root);
    this.open = false;
    this.epoch++;
    this.root.hidden = true;
    this.cancelHold();
    clearTimeout(this.pollTimer);
    clearTimeout(this.queryTimer);
    this.query?.dispose();
    this.query = null;
    this.result = null;
    this.map = null;
    this.target = null;
    this.busy = false;
    this.resetGesture();
    this.previousFocus?.focus();
  }

  destroy(): void {
    this.hide();
    window.removeEventListener("blur", this.resetGesture);
    this.resize.disconnect();
    this.root.remove();
  }

  private async refresh(epoch: number): Promise<void> {
    try {
      const map = await this.actions.snapshot();
      if (!this.open || epoch !== this.epoch || this.busy) return;
      const changed =
        !this.map ||
        this.map.worldId !== map.worldId ||
        descriptorKey(this.map.generation) !== descriptorKey(map.generation);
      this.map = map;
      this.title.textContent = `World map · ${map.name}`;
      this.root.dataset.worldId = map.worldId;
      if (changed) {
        this.query?.dispose();
        this.result = null;
        this.target = null;
        this.query = new QueryClient(
          new Worker(new URL("../explorer/regional.worker.ts", import.meta.url), {
            type: "module",
          }),
          (response) => {
            if (!this.open || epoch !== this.epoch) return;
            if (response.type === "result") {
              this.result = response.result;
              this.stops.replaceChildren();
              for (const station of (this.result.railways ?? []).flatMap((line) => line.stations)) {
                const button = this.button(`${station.town.name} station`, () => {
                  this.view.x = station.x;
                  this.view.y = station.y;
                  this.changed();
                });
                button.dataset.testid = "world-map-stop";
                button.dataset.stationId = station.id;
                button.dataset.x = String(station.x);
                button.dataset.y = String(station.y);
                this.stops.append(button);
              }
              this.tracks.replaceChildren();
              for (const track of this.result.racetracks ?? []) {
                const button = this.button(track.name, () => {
                  this.view.x = track.center.x;
                  this.view.y = track.center.y;
                  this.changed();
                });
                button.dataset.testid = "world-map-racetrack";
                button.dataset.trackId = track.id;
                this.tracks.append(button);
              }
              this.depots.replaceChildren();
              for (const depot of this.result.vehicleDepots ?? []) {
                const button = this.button(depot.name, () => {
                  this.view.x = depot.arrival.x;
                  this.view.y = depot.arrival.y;
                  this.target = { ...depot.arrival };
                  this.changed();
                });
                button.dataset.testid = "world-map-depot";
                button.dataset.depotId = depot.id;
                button.dataset.x = String(depot.arrival.x);
                button.dataset.y = String(depot.arrival.y);
                this.depots.append(button);
              }
              this.root.dataset.vehicleDepots = String(this.result.vehicleDepots?.length ?? 0);
              this.root.dataset.racetracks = String(this.result.racetracks?.length ?? 0);
              this.root.dataset.railLines = String(this.result.railways?.length ?? 0);
              this.root.dataset.settled = "true";
              this.draw();
            } else if (response.type === "error") this.status.textContent = response.message;
          },
        );
        this.view.zoom = 1;
        this.centerSelf();
        this.status.textContent =
          "Hold a location to travel there. Escape or G returns to the game.";
      }
      this.updateRoster();
      this.draw();
    } catch (error) {
      if (this.open && epoch === this.epoch) {
        this.status.textContent = `Map connection unavailable: ${String(error)}`;
        this.map = null;
        this.roster.replaceChildren();
        this.rosterButtons.clear();
        this.count.textContent = "Map unavailable";
        this.draw();
      }
    } finally {
      if (this.open && epoch === this.epoch)
        this.pollTimer = setTimeout(() => void this.refresh(epoch), 1000);
    }
  }

  private updateRoster(): void {
    const players = this.map?.players ?? [];
    this.count.textContent = `${players.length} ${players.length === 1 ? "player" : "players"}`;
    for (const [id, button] of this.rosterButtons) {
      if (!players.some((player) => player.playerNumber === id)) {
        button.remove();
        this.rosterButtons.delete(id);
      }
    }
    for (const player of players) {
      let button = this.rosterButtons.get(player.playerNumber);
      if (!button) {
        button = this.button("", () => {
          const current = this.map?.players.find((p) => p.playerNumber === player.playerNumber);
          if (current) this.center(current);
        });
        button.setAttribute("data-testid", "world-map-player");
        this.rosterButtons.set(player.playerNumber, button);
        this.roster.append(button);
      }
      button.textContent = `${player.self ? "You" : player.name}${player.indoors ? " · indoors" : ""}`;
      button.title = `${player.name} · ${Math.round(player.x)}, ${Math.round(player.y)}`;
      button.dataset.self = String(player.self);
      button.dataset.x = String(player.x);
      button.dataset.y = String(player.y);
      button.style.borderColor = player.color;
    }
  }

  private center(player: WorldMapPlayer): void {
    this.view = this.bounded({ ...this.view, x: player.x, y: player.y });
    this.changed();
  }
  private centerSelf(): void {
    const self = this.map?.players.find((player) => player.self);
    if (self) this.center(self);
    else this.changed();
  }
  private zoom(factor: number): void {
    this.cancelHold();
    this.view = this.bounded({ ...this.view, zoom: this.view.zoom * factor });
    this.changed();
  }
  private panController(dx: number, dy: number): void {
    this.view = this.bounded({
      ...this.view,
      x: this.view.x + (dx * this.width) / this.view.zoom / 4,
      y: this.view.y + (dy * this.height) / this.view.zoom / 4,
    });
    this.target = { x: this.view.x, y: this.view.y };
    this.changed();
  }
  private bounded(view: ViewState): ViewState {
    return {
      x: Math.max(-(2 ** 23), Math.min(2 ** 23, view.x)),
      y: Math.max(-(2 ** 23), Math.min(2 ** 23, view.y)),
      zoom: Math.max(0.02, Math.min(8, view.zoom)),
    };
  }
  private resized(): void {
    if (!this.open) return;
    const rect = this.canvas.getBoundingClientRect();
    this.width = Math.max(1, rect.width);
    this.height = Math.max(1, rect.height);
    const dpr = Math.min(devicePixelRatio, 2);
    this.canvas.width = Math.round(this.width * dpr);
    this.canvas.height = Math.round(this.height * dpr);
    this.changed();
  }
  private changed(): void {
    if (!this.open) return;
    this.cancelHold();
    this.root.dataset.settled = "false";
    this.root.dataset.x = String(this.view.x);
    this.root.dataset.y = String(this.view.y);
    this.root.dataset.zoom = String(this.view.zoom);
    this.query?.invalidate();
    this.draw();
    clearTimeout(this.queryTimer);
    this.queryTimer = setTimeout(() => {
      if (!this.map || !this.open) return;
      this.query?.submit(this.map.generation, {
        bounds: visibleBounds(this.view, this.width, this.height),
        detail: "region",
        sampleStep: 4 / this.view.zoom,
        limits: { ...QUERY_LIMITS, maxSamples: 16_384 },
      });
    }, 80);
  }

  private draw(): void {
    if (!this.open) return;
    this.renderer.draw(
      this.canvas,
      this.width,
      this.height,
      this.view,
      DEFAULT_OVERLAYS,
      this.result,
      null,
    );
    const ctx = this.canvas.getContext("2d");
    if (!ctx) return;
    const screen = (p: Point) => ({
      x: (p.x - this.view.x) * this.view.zoom + this.width / 2,
      y: (p.y - this.view.y) * this.view.zoom + this.height / 2,
    });
    for (const player of this.map?.players ?? []) {
      const p = screen(player);
      if (p.x < -10 || p.y < -10 || p.x > this.width + 10 || p.y > this.height + 10) continue;
      ctx.beginPath();
      ctx.arc(p.x, p.y, player.self ? 7 : 5, 0, Math.PI * 2);
      ctx.fillStyle = player.self ? "#1b7565" : player.color;
      ctx.fill();
      ctx.strokeStyle = "white";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.font = "bold 12px system-ui";
      ctx.textAlign = "center";
      const name = player.self ? "You" : player.name;
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#f6f3e8";
      ctx.strokeText(name, p.x, p.y - 13);
      ctx.fillStyle = "#183c32";
      ctx.fillText(name, p.x, p.y - 13);
    }
    if (this.target) {
      const p = screen(this.target);
      ctx.strokeStyle = "#9b422d";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
      ctx.moveTo(p.x - 15, p.y);
      ctx.lineTo(p.x + 15, p.y);
      ctx.moveTo(p.x, p.y - 15);
      ctx.lineTo(p.x, p.y + 15);
      ctx.stroke();
    }
    ctx.textAlign = "left";
    const tiles = 2 ** Math.floor(Math.log2(100 / this.view.zoom));
    ctx.fillStyle = "#183c32";
    ctx.font = "12px system-ui";
    ctx.fillText(`${tiles} tiles`, 16, this.height - 24);
    ctx.fillRect(16, this.height - 16, tiles * this.view.zoom, 3);
  }

  private point(event: MouseEvent): Point {
    const rect = this.canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }
  private cancelHold(): void {
    clearTimeout(this.holdTimer);
    this.holdTimer = undefined;
  }
  private pointerDown(event: PointerEvent): void {
    if (event.pointerType === "touch" && this.nativeTouchEvents) return;
    if (this.busy || event.button !== 0) return;
    event.preventDefault();
    this.canvas.focus();
    this.canvas.setPointerCapture(event.pointerId);
    this.beginContact(event.pointerId, this.point(event));
  }
  private beginContact(id: number, point: Point): void {
    if (this.busy) return;
    this.pointers.set(id, point);
    this.cancelHold();
    if (this.pointers.size > 1) {
      this.gesture = null;
      this.pinch = null;
      if (this.pointers.size !== 2) return;
      const [a, b] = [...this.pointers.values()];
      if (a && b)
        this.pinch = {
          distance: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)),
          view: { ...this.view },
          center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        };
      return;
    }
    this.gesture = { origin: point, view: { ...this.view }, dragged: false, held: false };
    this.holdTimer = setTimeout(() => {
      if (!this.gesture || this.gesture.dragged || !this.map) return;
      this.gesture.held = true;
      void this.travel(screenToWorld(this.view, this.width, this.height, point));
    }, 650);
  }
  private pointerMove(event: PointerEvent): void {
    if (event.pointerType === "touch" && this.nativeTouchEvents) return;
    if (!this.pointers.has(event.pointerId) || this.busy) return;
    event.preventDefault();
    this.moveContact(event.pointerId, this.point(event));
  }
  private moveContact(id: number, point: Point): void {
    if (!this.pointers.has(id) || this.busy) return;
    this.pointers.set(id, point);
    if (this.pinch && this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()];
      if (!a || !b) return;
      const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const anchor = screenToWorld(this.pinch.view, this.width, this.height, this.pinch.center);
      const zoom = this.bounded({
        ...this.view,
        zoom: (this.pinch.view.zoom * Math.hypot(b.x - a.x, b.y - a.y)) / this.pinch.distance,
      }).zoom;
      this.view = this.bounded({
        x: anchor.x - (center.x - this.width / 2) / zoom,
        y: anchor.y - (center.y - this.height / 2) / zoom,
        zoom,
      });
      this.changed();
      return;
    }
    const gesture = this.gesture;
    if (!gesture || gesture.held) return;
    const dx = point.x - gesture.origin.x,
      dy = point.y - gesture.origin.y;
    if (Math.hypot(dx, dy) > 10) {
      gesture.dragged = true;
      this.cancelHold();
    }
    if (gesture.dragged) {
      this.view = this.bounded({
        ...gesture.view,
        x: gesture.view.x - dx / gesture.view.zoom,
        y: gesture.view.y - dy / gesture.view.zoom,
      });
      this.changed();
    }
  }
  private pointerUp(event: PointerEvent, cancelled: boolean): void {
    if (event.pointerType === "touch" && this.nativeTouchEvents) return;
    this.endContact(event.pointerId, this.point(event), cancelled);
  }
  private selectPoint(point: Point): void {
    this.target = screenToWorld(this.view, this.width, this.height, point);
    this.status.textContent = `Hold or choose Travel to selected point near ${Math.round(this.target.x)}, ${Math.round(this.target.y)}.`;
    this.draw();
  }
  private endContact(id: number, point: Point, cancelled: boolean): void {
    if (!this.pointers.has(id)) return;
    this.cancelHold();
    if (!cancelled && this.gesture && !this.gesture.dragged && !this.gesture.held) {
      this.selectPoint(point);
    }
    this.pointers.delete(id);
    this.gesture = null;
    this.pinch = null;
    // Continue panning with the remaining finger; it must never become a travel hold.
    if (!cancelled && this.pointers.size === 1) {
      const origin = [...this.pointers.values()][0];
      if (origin) this.gesture = { origin, view: { ...this.view }, dragged: true, held: false };
    }
  }
  private resetGesture = (): void => {
    this.cancelHold();
    this.pointers.clear();
    this.gesture = null;
    this.pinch = null;
  };
  private touchStart = (event: TouchEvent): void => {
    event.preventDefault();
    if (!this.nativeTouchEvents) {
      // A hybrid Chromebook can emit both streams without advertising
      // ontouchstart. Replace the provisional pointer contact, otherwise one
      // physical finger becomes two pinch contacts with different identifiers.
      this.nativeTouchEvents = true;
      this.resetGesture();
    }
    this.canvas.focus();
    const rect = this.canvas.getBoundingClientRect();
    for (const touch of event.changedTouches)
      this.beginContact(touch.identifier, {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      });
  };
  private touchMove = (event: TouchEvent): void => {
    event.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    for (const touch of event.changedTouches)
      this.moveContact(touch.identifier, {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      });
  };
  private touchEnd = (event: TouchEvent): void => {
    event.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    for (const touch of event.changedTouches)
      this.endContact(
        touch.identifier,
        { x: touch.clientX - rect.left, y: touch.clientY - rect.top },
        false,
      );
  };
  private touchCancel = (event: TouchEvent): void => {
    event.preventDefault();
    this.resetGesture();
  };
  private async travel(point: Point): Promise<void> {
    if (!this.map || this.busy) return;
    this.busy = true;
    const epoch = this.epoch;
    this.target = point;
    this.status.textContent = "Travelling to nearby safe ground…";
    this.draw();
    try {
      await this.actions.travel(this.map, point);
      if (this.open && epoch === this.epoch) this.actions.close();
    } catch (error) {
      if (this.open && epoch === this.epoch)
        this.status.textContent = `Travel failed: ${String(error)}`;
    } finally {
      if (epoch === this.epoch) this.busy = false;
    }
  }
  private keyDown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      this.actions.close();
      return;
    }
    if (event.key === "Tab") {
      const items = [...this.dialog.querySelectorAll<HTMLElement>("button, canvas")];
      const first = items[0],
        last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
      event.stopPropagation();
      return;
    }
    const pan = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[
      event.key
    ];
    if (pan) {
      event.preventDefault();
      event.stopPropagation();
      this.cancelHold();
      this.view = this.bounded({
        ...this.view,
        x: this.view.x + ((pan[0] ?? 0) * 80) / this.view.zoom,
        y: this.view.y + ((pan[1] ?? 0) * 80) / this.view.zoom,
      });
      this.changed();
    }
  }
}
