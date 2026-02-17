import type { ClientMessage, ServerMessage } from "../shared/protocol.js";

export const WEBRTC_SYNC_CHANNEL_LABEL = "sync";
export const WEBRTC_ENTITIES_CHANNEL_LABEL = "entities";
export const WEBRTC_LEGACY_SYNC_CHANNEL_LABEL = "game";

export type WebRtcGameplayChannel = "sync" | "entities";

export interface RoutedServerMessageChannel {
  preferred: WebRtcGameplayChannel;
  channel: WebRtcGameplayChannel;
  fellBack: boolean;
}

/**
 * Frame hot-path messages are candidates for the unreliable entities channel.
 * Everything else must stay on reliable/ordered sync.
 */
export function classifyServerMessageChannel(msg: ServerMessage): WebRtcGameplayChannel {
  return msg.type === "frame" ? "entities" : "sync";
}

/** Phase 6 keeps all client→server traffic reliable/ordered. */
export function classifyClientMessageChannel(_msg: ClientMessage): WebRtcGameplayChannel {
  return "sync";
}

export function routeServerMessageChannel(
  msg: ServerMessage,
  entitiesAvailable: boolean,
): RoutedServerMessageChannel {
  const preferred = classifyServerMessageChannel(msg);
  if (preferred === "entities" && !entitiesAvailable) {
    return { preferred, channel: "sync", fellBack: true };
  }
  return { preferred, channel: preferred, fellBack: false };
}

export function classifyDataChannelLabel(label: string | undefined): WebRtcGameplayChannel | null {
  if (!label) return null;
  if (label === WEBRTC_SYNC_CHANNEL_LABEL || label === WEBRTC_LEGACY_SYNC_CHANNEL_LABEL) {
    return "sync";
  }
  if (label === WEBRTC_ENTITIES_CHANNEL_LABEL) {
    return "entities";
  }
  return null;
}
