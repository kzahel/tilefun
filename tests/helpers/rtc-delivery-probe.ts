import type { Page } from "@playwright/test";
import { encodeServerMessage } from "../../src/shared/binaryCodec.js";

const emptyFrame = encodeServerMessage({
  type: "frame",
  serverTick: 0,
  lastProcessedInputSeq: 0,
  playerEntityId: 0,
});
export const RTC_FRAME_LAYOUT = {
  frameTag: new DataView(emptyFrame).getUint8(0),
  frameHeaderSize: emptyFrame.byteLength,
};

export interface RtcProbe {
  channels: RTCDataChannel[];
  mode: "pass" | "drop-baseline" | "drop-exit" | "hold-baseline" | "hold-sync";
  dropped: number;
  appliedFrames: number;
  entitiesFrames: number;
  syncFrames: number;
  bytes: number;
  held: Array<{ channel: RTCDataChannel; event: MessageEvent }>;
  release(): void;
}

declare global {
  interface Window {
    __rtcProbe: RtcProbe;
  }
}

/** Test-only interception at the actual RTC receive boundary, before production decoding.
 * Reliable sync/input is never dropped; hold-sync delays the whole receive stream. This is message loss, not UDP/SCTP emulation.
 */
export async function installRtcProbe(page: Page): Promise<void> {
  await page.addInitScript(({ frameTag, frameHeaderSize }) => {
    const probe: RtcProbe = {
      channels: [],
      mode: "pass",
      dropped: 0,
      appliedFrames: 0,
      entitiesFrames: 0,
      syncFrames: 0,
      bytes: 0,
      held: [],
      release() {
        this.mode = "pass";
        for (const { channel, event } of this.held.splice(0)) {
          channel.onmessage?.call(channel, event);
        }
      },
    };
    window.__rtcProbe = probe;
    const create = RTCPeerConnection.prototype.createDataChannel;
    RTCPeerConnection.prototype.createDataChannel = function (label, options) {
      const channel = create.call(this, label, options);
      probe.channels.push(channel);
      // Registered before WebRtcClientTransport assigns onmessage.
      channel.addEventListener("message", (event: MessageEvent) => {
        if (label === "sync" && probe.mode === "hold-sync") {
          event.stopImmediatePropagation();
          probe.held.push({ channel, event });
        }
        if (!(event.data instanceof ArrayBuffer)) return;
        probe.bytes += event.data.byteLength;
        const bytes = new DataView(event.data);
        if (bytes.byteLength < frameHeaderSize || bytes.getUint8(0) !== frameTag) return;
        if (label === "sync") {
          probe.syncFrames++;
          return;
        }
        if (label !== "entities") return;
        probe.entitiesFrames++;
        // The fixed header ends in u16 baseline/delta/exit counts. Derive its
        // current tag/size from the encoder; codec tests own the wire schema.
        const baseline = bytes.getUint16(frameHeaderSize - 6, true) > 0;
        const exit = bytes.getUint16(frameHeaderSize - 2, true) > 0;
        if ((probe.mode === "drop-baseline" && baseline) || (probe.mode === "drop-exit" && exit)) {
          event.stopImmediatePropagation();
          probe.dropped++;
          probe.mode = "pass";
        } else if (probe.mode === "hold-baseline" && baseline) {
          event.stopImmediatePropagation();
          probe.held.push({ channel, event });
          probe.mode = "pass";
        }
      });
      return channel;
    };
  }, RTC_FRAME_LAYOUT);
}
