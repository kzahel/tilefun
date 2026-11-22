/** Maximum spread of the local party's body centres in ground-plane world pixels. */
export interface SharedScreenSpan {
  readonly x: number;
  readonly y: number;
}

/** Use whole world pixels within the packet's uint16 range, with room for a party in tiny windows. */
export function normalizeSharedScreenSpan({ x, y }: SharedScreenSpan): SharedScreenSpan {
  return { x: boundedSpan(x), y: boundedSpan(y) };
}

function boundedSpan(value: number): number {
  return Number.isFinite(value) ? Math.max(32, Math.min(0xffff, Math.floor(value))) : 32;
}

/** Fixed spread sent by older clients as a mode bit with no dimensions. */
export const LEGACY_SHARED_SCREEN_SPAN: SharedScreenSpan = { x: 352, y: 224 };
