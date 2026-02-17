export const WEBRTC_FRAGMENT_MAGIC_0 = 0xfa;
export const WEBRTC_FRAGMENT_MAGIC_1 = 0xce;
export const WEBRTC_FRAGMENT_HEADER_BYTES = 10;
export const WEBRTC_FRAGMENT_DEFAULT_MAX_PAYLOAD_BYTES = 8 * 1024;

export interface WebRtcFragment {
  messageId: number;
  partIndex: number;
  partCount: number;
  payload: Uint8Array;
}

export function fragmentForDataChannel(
  message: Uint8Array,
  messageId: number,
  maxPayloadBytes = WEBRTC_FRAGMENT_DEFAULT_MAX_PAYLOAD_BYTES,
): Uint8Array[] {
  if (maxPayloadBytes <= 0) {
    throw new Error("maxPayloadBytes must be > 0");
  }
  if (message.byteLength <= maxPayloadBytes) {
    return [message];
  }

  const partCount = Math.ceil(message.byteLength / maxPayloadBytes);
  if (partCount > 0xffff) {
    throw new Error(`Message too large to fragment: ${message.byteLength} bytes`);
  }

  const packets: Uint8Array[] = [];
  for (let partIndex = 0; partIndex < partCount; partIndex++) {
    const start = partIndex * maxPayloadBytes;
    const end = Math.min(message.byteLength, start + maxPayloadBytes);
    const payload = message.subarray(start, end);
    packets.push(encodeFragmentPacket(messageId, partIndex, partCount, payload));
  }
  return packets;
}

export function decodeFragmentPacket(packet: Uint8Array): WebRtcFragment | null {
  if (packet.byteLength < WEBRTC_FRAGMENT_HEADER_BYTES) return null;
  if (packet[0] !== WEBRTC_FRAGMENT_MAGIC_0 || packet[1] !== WEBRTC_FRAGMENT_MAGIC_1) return null;

  const view = new DataView(packet.buffer, packet.byteOffset, packet.byteLength);
  const messageId = view.getUint32(2, true);
  const partIndex = view.getUint16(6, true);
  const partCount = view.getUint16(8, true);
  if (partCount === 0 || partIndex >= partCount) return null;

  return {
    messageId,
    partIndex,
    partCount,
    payload: packet.subarray(WEBRTC_FRAGMENT_HEADER_BYTES),
  };
}

function encodeFragmentPacket(
  messageId: number,
  partIndex: number,
  partCount: number,
  payload: Uint8Array,
): Uint8Array {
  const out = new Uint8Array(WEBRTC_FRAGMENT_HEADER_BYTES + payload.byteLength);
  out[0] = WEBRTC_FRAGMENT_MAGIC_0;
  out[1] = WEBRTC_FRAGMENT_MAGIC_1;
  const view = new DataView(out.buffer, out.byteOffset, out.byteLength);
  view.setUint32(2, messageId >>> 0, true);
  view.setUint16(6, partIndex, true);
  view.setUint16(8, partCount, true);
  out.set(payload, WEBRTC_FRAGMENT_HEADER_BYTES);
  return out;
}
