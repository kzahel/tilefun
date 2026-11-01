import { PLAYER_FOOT_OFFSET } from "./BridgeFixture.js";
import type { PhysicsInput, RapierWorld } from "./RapierWorld.js";

export type PhysicsSeat = 0 | 1;
export type PairScenario = "push" | "opposed" | "push-player" | "lift" | "start-stop" | "reversal";
export const PAIR_SCENARIOS: { id: PairScenario; name: string }[] = [
  { id: "push", name: "Push while watched" },
  { id: "opposed", name: "Opposing pushes" },
  { id: "push-player", name: "Push into player" },
  { id: "lift", name: "Shared lift and jump" },
  { id: "start-stop", name: "Remote start / stop" },
  { id: "reversal", name: "Quick left / right" },
];
export const NEUTRAL: PhysicsInput = { x: 0, z: 0, jump: false };
export function setupPair(world: RapierWorld, scene: PairScenario) {
  const y = PLAYER_FOOT_OFFSET + 0.04;
  world.configurePair(
    scene === "lift"
      ? [
          { x: -3.65, y: y + 0.2, z: 6.5 },
          { x: -2.35, y: y + 0.2, z: 6.5 },
        ]
      : [
          { x: -14, y, z: 0 },
          { x: scene === "push-player" ? -11 : -10, y, z: 0 },
        ],
    scene === "lift" || scene === "start-stop" ? null : { x: -12.5, y: 0.42, z: 0 },
  );
}
/** Tick-addressed inputs, shared by visual playback and native tests. */
export function pairInput(scene: PairScenario, seat: PhysicsSeat, tick: number): PhysicsInput {
  if (scene === "reversal") {
    if (seat !== 0 || tick < 40 || tick >= 170) return NEUTRAL;
    const left =
      (tick >= 60 && tick < 64) || (tick >= 100 && tick < 104) || (tick >= 130 && tick < 134);
    return { x: left ? -1 : 1, z: 0, jump: false };
  }
  if (scene === "start-stop")
    return seat === 0 && tick >= 60 && tick < 95 ? { x: 0, z: 1, jump: false } : NEUTRAL;
  if (scene === "lift")
    return seat === 1 && tick >= 150 && tick < 180 ? { x: 0, z: 1, jump: tick < 156 } : NEUTRAL;
  if (tick < 30 || tick >= 125) return NEUTRAL;
  if (seat === 0) return { x: 1, z: 0, jump: false };
  return scene === "opposed" && tick < 95 ? { x: -1, z: 0, jump: false } : NEUTRAL;
}
