/** Small margin for rendering effects not captured by sprite bounds. */
const CULL_MARGIN = 16;

/** Viewport edges in world coordinates, widened by the effects margin. */
export interface CullBounds {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

export function cullBounds(
  topLeft: { wx: number; wy: number },
  bottomRight: { wx: number; wy: number },
): CullBounds {
  return {
    left: topLeft.wx - CULL_MARGIN,
    right: bottomRight.wx + CULL_MARGIN,
    top: topLeft.wy - CULL_MARGIN,
    bottom: bottomRight.wy + CULL_MARGIN,
  };
}

/** A horizontally centered world box entirely beyond one widened viewport edge. */
export function outsideView(
  cull: CullBounds,
  wx: number,
  halfW: number,
  top: number,
  bottom: number,
): boolean {
  return (
    wx + halfW < cull.left || wx - halfW > cull.right || bottom < cull.top || top > cull.bottom
  );
}
