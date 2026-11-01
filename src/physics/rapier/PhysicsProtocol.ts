import type { PhysicsStart } from "./BridgeFixture.js";
import type { PhysicsDiagnostics, PhysicsMotorState } from "./RapierWorld.js";

export const POSE_STRIDE = 14;

export type PhysicsPacket = (
  | { type: "open"; sections: number }
  | { type: "input"; buffer: ArrayBuffer }
  | { type: "teleport"; start: PhysicsStart }
  | { type: "spawn"; count: number }
  | { type: "pause"; paused: boolean }
  | { type: "resync" }
  | { type: "stall"; milliseconds: number }
  | { type: "engine"; buffer: ArrayBuffer }
  | { type: "ready" }
  | {
      type: "frame";
      buffer: ArrayBuffer;
      diagnostics: PhysicsDiagnostics;
      motor: PhysicsMotorState;
      ack: number;
    }
  | { type: "error"; message: string }
) & { buffer?: ArrayBuffer };
