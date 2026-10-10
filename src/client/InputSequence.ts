import type { IClientTransport } from "../transport/Transport.js";

/** A play scene can be replaced without replacing its connection/authority. */
const submitted = new WeakMap<IClientTransport, number>();

export function observeInputSequence(transport: IClientTransport, acknowledged: number): void {
  submitted.set(transport, Math.max(submitted.get(transport) ?? 0, acknowledged));
}

export function nextInputSequence(transport: IClientTransport, acknowledged = 0): number {
  observeInputSequence(transport, acknowledged);
  const seq = (submitted.get(transport) ?? 0) + 1;
  submitted.set(transport, seq);
  return seq;
}
