import type { PeerOptions } from "peerjs";
/** Optional self-hosted signaling; gameplay still travels directly over WebRTC. */
export function peerOptions(): PeerOptions {
  const options: PeerOptions = {
    // PeerJS catches native send errors before closing. Keep those errors and
    // their original stacks visible instead of its default stringification.
    debug: 1,
    logFunction: (_level, ...args: unknown[]) => console.error("[tilefun] PeerJS:", ...args),
    config: {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    },
  };
  const override = new URL(location.href).searchParams.get("peerServer");
  if (override) {
    const url = new URL(override);
    if (!["http:", "https:"].includes(url.protocol))
      throw Error("Peer signaling must use HTTP or HTTPS.");
    Object.assign(options, {
      host: url.hostname,
      port: Number(url.port) || (url.protocol === "https:" ? 443 : 80),
      path: url.pathname,
      secure: url.protocol === "https:",
    });
  }
  return options;
}
