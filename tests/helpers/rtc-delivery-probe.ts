import type { Page } from "@playwright/test";

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
  await page.addInitScript(() => {
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
        if (bytes.byteLength < 19 || bytes.getUint8(0) !== 0x01) return;
        if (label === "sync") {
          probe.syncFrames++;
          return;
        }
        if (label !== "entities") return;
        probe.entitiesFrames++;
        // Current FrameMessage binary header: tag, tick, input seq, player ID,
        // then u16 baseline/delta/exit counts. Codec tests own this schema.
        const baseline = bytes.getUint16(13, true) > 0;
        const exit = bytes.getUint16(17, true) > 0;
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
  });
}
