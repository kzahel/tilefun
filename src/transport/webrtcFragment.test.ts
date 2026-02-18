import { describe, expect, it } from "vitest";
import { decodeFragmentPacket, fragmentForDataChannel } from "./webrtcFragment.js";

function concat(parts: readonly Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, p) => sum + p.byteLength, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.byteLength;
  }
  return out;
}

describe("webrtcFragment", () => {
  it("returns original packet when payload already fits", () => {
    const msg = new Uint8Array([1, 2, 3, 4]);
    const packets = fragmentForDataChannel(msg, 7, 64);
    expect(packets).toHaveLength(1);
    const firstPacket = packets[0];
    expect(firstPacket).toBeDefined();
    if (!firstPacket) throw new Error("Expected one packet");
    expect(firstPacket).toEqual(msg);
    expect(decodeFragmentPacket(firstPacket)).toBeNull();
  });

  it("splits oversized payload and decodes fragment headers", () => {
    const msg = new Uint8Array(5000);
    for (let i = 0; i < msg.length; i++) msg[i] = i % 251;

    const packets = fragmentForDataChannel(msg, 42, 1024);
    expect(packets.length).toBeGreaterThan(1);

    const payloads: Uint8Array[] = [];
    for (let i = 0; i < packets.length; i++) {
      const packet = packets[i];
      if (!packet) throw new Error("Missing packet");
      const decoded = decodeFragmentPacket(packet);
      if (!decoded) {
        throw new Error("Expected fragment packet");
      }
      const fragment = decoded;
      expect(fragment.messageId).toBe(42);
      expect(fragment.partIndex).toBe(i);
      expect(fragment.partCount).toBe(packets.length);
      payloads.push(fragment.payload);
    }

    expect(concat(payloads)).toEqual(msg);
  });

  it("rejects malformed fragment packets", () => {
    expect(decodeFragmentPacket(new Uint8Array([0xfa, 0xce]))).toBeNull();
    expect(
      decodeFragmentPacket(
        // Magic + messageId + partIndex=2 + partCount=2 (invalid index >= count)
        new Uint8Array([0xfa, 0xce, 1, 0, 0, 0, 2, 0, 2, 0, 99]),
      ),
    ).toBeNull();
  });
});
