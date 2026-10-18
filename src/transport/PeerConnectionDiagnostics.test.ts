import type { DataConnection } from "peerjs";
import { afterEach, expect, it, vi } from "vitest";
import { PeerConnectionDiagnostics } from "./PeerConnectionDiagnostics.js";

afterEach(() => vi.restoreAllMocks());

function rig() {
  const connection = {
    connectionId: "connection",
    serialization: "binary",
    send: vi.fn(),
    close: vi.fn(),
    peerConnection: {
      sctp: { maxMessageSize: 262144 },
      connectionState: "connected",
      iceConnectionState: "connected",
    },
    dataChannel: { bufferedAmount: 123, readyState: "open" },
  };
  const diagnostics = new PeerConnectionDiagnostics(
    "host",
    connection as unknown as DataConnection,
  );
  return { connection, diagnostics };
}
it("retains only the most recent send metadata and records native transport limits on closure", () => {
  const log = vi.spyOn(console, "warn").mockImplementation(() => {});
  const { connection, diagnostics } = rig();
  diagnostics.opened();
  diagnostics.send("frame", new ArrayBuffer(27));
  diagnostics.send("sync-chunks", new ArrayBuffer(662134));
  Reflect.deleteProperty(connection, "peerConnection");
  Reflect.deleteProperty(connection, "dataChannel");
  diagnostics.log("host channel closed");
  expect(connection.send).toHaveBeenCalledTimes(2);
  expect(log).toHaveBeenCalledWith("[tilefun] P2P host channel closed", {
    role: "host",
    connectionId: "connection",
    serialization: "binary",
    connectionAgeMs: expect.any(Number),
    lastSent: { type: "sync-chunks", bytes: 662134 },
    maxMessageSize: 262144,
    bufferedBytes: 123,
    channelState: "open",
    connectionState: "connected",
    iceState: "connected",
  });
});
it("preserves a thrown send exception and closes the failed connection", () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const { connection, diagnostics } = rig();
  const error = new TypeError("message too large");
  connection.send.mockImplementation(() => {
    throw error;
  });
  diagnostics.send("sync-chunks", new ArrayBuffer(662134));
  expect(log).toHaveBeenCalledWith(
    "[tilefun] P2P send threw",
    expect.objectContaining({
      lastSent: { type: "sync-chunks", bytes: 662134 },
    }),
    error,
  );
  expect(connection.close).toHaveBeenCalledOnce();
});
