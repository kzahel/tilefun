import { surfaceDisplay, surfaceFadeOpacity } from "../SurfacePresentation.js";
import type { OverheadDeck } from "./FirstPersonPropMeshes.js";
import type { FirstPersonFrame } from "./FirstPersonView.js";

/** Explicit level selection hides a slab; automatic cutaways ease its opacity. */
export function deckOpacity(deck: OverheadDeck, cutaway: FirstPersonFrame["cutaway"]): number {
  if (!cutaway) return 1;
  const display = surfaceDisplay(
    deck.patch,
    deck.bounds,
    cutaway.observer,
    cutaway.visibility ?? "auto",
    cutaway.alpha,
  );
  if (display === "hidden" || (cutaway.visibility && cutaway.visibility !== "auto")) {
    cutaway.fades.delete(deck.id);
    return display === "hidden" ? 0 : 1;
  }
  return surfaceFadeOpacity(cutaway.fades, deck.id, display, cutaway.time);
}
