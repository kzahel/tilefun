import { describe, expect, it } from "vitest";
import type { ClientMessage, ServerMessage } from "../shared/protocol.js";
import {
  classifyClientMessageChannel,
  classifyDataChannelLabel,
  classifyServerMessageChannel,
  routeServerMessageChannel,
  WEBRTC_ENTITIES_CHANNEL_LABEL,
  WEBRTC_LEGACY_SYNC_CHANNEL_LABEL,
  WEBRTC_SYNC_CHANNEL_LABEL,
} from "./webrtcChannels.js";

describe("webrtcChannels", () => {
  it("routes frame messages to entities channel", () => {
    const frame: ServerMessage = {
      type: "frame",
      serverTick: 1,
      lastProcessedInputSeq: 0,
      playerEntityId: 7,
    };
    expect(classifyServerMessageChannel(frame)).toBe("entities");
  });

  it("routes sync/control messages to sync channel", () => {
    const syncMsg: ServerMessage = {
      type: "sync-chunks",
      loadedChunkKeys: ["0,0"],
    };
    const controlMsg: ServerMessage = {
      type: "world-loaded",
      cameraX: 0,
      cameraY: 0,
      cameraZoom: 1,
    };
    expect(classifyServerMessageChannel(syncMsg)).toBe("sync");
    expect(classifyServerMessageChannel(controlMsg)).toBe("sync");
  });

  it("keeps all client messages on reliable sync channel for phase 6", () => {
    const input: ClientMessage = {
      type: "player-input",
      seq: 1,
      dx: 1,
      dy: 0,
      sprinting: false,
      jump: false,
    };
    const terrainEdit: ClientMessage = {
      type: "edit-road",
      tx: 1,
      ty: 2,
      roadType: 3,
      paintMode: "positive",
    };
    expect(classifyClientMessageChannel(input)).toBe("sync");
    expect(classifyClientMessageChannel(terrainEdit)).toBe("sync");
  });

  it("falls back frame routing to sync when entities channel is unavailable", () => {
    const frame: ServerMessage = {
      type: "frame",
      serverTick: 1,
      lastProcessedInputSeq: 0,
      playerEntityId: 7,
    };
    expect(routeServerMessageChannel(frame, false)).toEqual({
      preferred: "entities",
      channel: "sync",
      fellBack: true,
    });
    expect(routeServerMessageChannel(frame, true)).toEqual({
      preferred: "entities",
      channel: "entities",
      fellBack: false,
    });
  });

  it("classifies known sync/entities labels and rejects unknown labels", () => {
    expect(classifyDataChannelLabel(WEBRTC_SYNC_CHANNEL_LABEL)).toBe("sync");
    expect(classifyDataChannelLabel(WEBRTC_LEGACY_SYNC_CHANNEL_LABEL)).toBe("sync");
    expect(classifyDataChannelLabel(WEBRTC_ENTITIES_CHANNEL_LABEL)).toBe("entities");
    expect(classifyDataChannelLabel("unknown")).toBeNull();
    expect(classifyDataChannelLabel(undefined)).toBeNull();
  });
});
