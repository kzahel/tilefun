import type { PerformanceSnapshot } from "../diagnostics/PerformanceMetrics.js";
import type { OrderedWorkerChannel } from "../transport/OrderedWorkerChannel.js";
import type { ConnectionIdentity } from "../transport/Transport.js";
export type LocalHostPacket = { buffer?: ArrayBuffer } & (
  | { type: "message"; buffer: ArrayBuffer }
  | { type: "connect"; identity?: ConnectionIdentity }
  | { type: "start" }
  | { type: "visibility"; hidden: boolean }
  | { type: "flush" | "shutdown" | "diagnostics" | "reset-diagnostics"; id: number }
  | { type: "result"; id: number; error?: string; diagnostics?: LocalHostDiagnostics }
);
export interface LocalHostDiagnostics {
  timings: PerformanceSnapshot;
  channel: ReturnType<OrderedWorkerChannel<LocalHostPacket>["diagnostics"]>;
  ticks: number;
  hidden: boolean;
  persistence?: import("../server/GameServer.js").GameServer["persistenceDiagnostics"];
}
export type LocalHostBoot =
  | { kind: "init"; metrics: boolean }
  | { kind: "ready" }
  | { kind: "failed"; error: string };
