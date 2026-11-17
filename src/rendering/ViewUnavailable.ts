import { VIEW_BACKDROP_CSS } from "../config/constants.js";
import type { View } from "../session/View.js";
import { type OverlayDraw, OverlayFrame } from "./OverlayFrame.js";

const frame = new OverlayFrame();
/** Loading/lost graphics is an opaque UI frame, never another world renderer. */
export function drawViewUnavailable(
  draw: ((items: readonly OverlayDraw[]) => void) | undefined,
  view: View,
  message = "Loading world…",
) {
  if (!draw) return;
  const { x, y, width, height } = view.region;
  frame.begin();
  try {
    frame.rect(x, y, width, height, VIEW_BACKDROP_CSS);
    frame.label(message, x + width / 2, y + height / 2, "#fff", "16px sans-serif", true);
    draw(frame.items);
  } finally {
    frame.release();
  }
}
