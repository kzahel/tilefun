import { Camera } from "../rendering/Camera.js";
import { type ViewLayout, ViewLayouts } from "../rendering/ViewLayout.js";
import type { DeviceSeats } from "./DeviceSeats.js";
import { followSeat, View } from "./View.js";

/** Views zoom out to this share of the chosen zoom when four regions share the canvas
 * (3–4 players; decided under autonomy, 226). */
export const SPLIT_ZOOM = 0.75;

/** Fixed split-screen layouts: one view, two side by side, or a 2×2 grid for 3–4 seats. */
export function seatLayout(count: number): ViewLayout {
  return count <= 1 ? "1" : count === 2 ? "2" : "4";
}

/**
 * One view per seat of a device (226), in seat order: seat 0's own view first and
 * one for each guest, made from seat 0's camera policy and pixel snapping. Seat 0
 * is shown alone outside play, so the editor keeps one whole-canvas view.
 */
export class SeatViews {
  private readonly layouts = new ViewLayouts();
  private readonly guests = new Map<number, View>();

  constructor(
    private readonly seats: DeviceSeats,
    readonly host: View,
  ) {}

  /** The views to draw, with their regions and zoom set for this canvas size. */
  layout(width: number, height: number, split: boolean): View[] {
    // Guests' views go with their seats, and outside play (they start afresh).
    for (const seat of this.guests.keys())
      if (!split || !this.seats.get(seat)) this.guests.delete(seat);
    const views = (split ? this.seats.list() : [this.seats.host]).map((seat) =>
      seat.seat === 0 ? this.host : this.guestView(seat.seat),
    );
    const regions = this.layouts.get(seatLayout(views.length), width, height);
    const zoomScale = views.length > 2 ? SPLIT_ZOOM : 1;
    views.forEach((view, index) => {
      const region = regions[index]?.region;
      if (region && region !== view.region) view.setRegion(region);
      view.zoomScale = zoomScale;
    });
    return views;
  }

  private guestView(seat: number): View {
    let view = this.guests.get(seat);
    if (!view) {
      // Start where seat 0 looks (not the world origin) until the guest streams in.
      const camera = new Camera();
      camera.pixelSnap = this.host.camera.pixelSnap;
      camera.snapTo(this.host.camera.x, this.host.camera.y);
      camera.requestSnap();
      view = new View(this.host.policy.forSeat?.(seat) ?? followSeat({ seat }), camera, seat);
      this.guests.set(seat, view);
    }
    return view;
  }
}
