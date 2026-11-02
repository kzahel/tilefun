import RAPIER from "@dimforge/rapier3d-compat";
import { type PhysicsShape, PLAYER_FOOT_OFFSET, slabVertices } from "./BridgeFixture.js";
import type { PhysicsInput, RapierWorld } from "./RapierWorld.js";

export type PhysicsSeat = 0 | 1;
export type PairScenario =
  | "push"
  | "opposed"
  | "push-player"
  | "lift"
  | "start-stop"
  | "reversal"
  | "player-head-on"
  | "player-glance"
  | "player-push"
  | "player-stack"
  | "player-land"
  | "player-jump";
export const PAIR_SCENARIOS: { id: PairScenario; name: string }[] = [
  { id: "push", name: "Push while watched" },
  { id: "opposed", name: "Opposing pushes" },
  { id: "push-player", name: "Push into player" },
  { id: "player-push", name: "Players pushing / release" },
  { id: "player-stack", name: "Walk across player shoulders" },
  { id: "player-land", name: "Land and stand on player" },
  { id: "player-jump", name: "Jump against pinned player" },
  { id: "player-head-on", name: "Players head-on" },
  { id: "player-glance", name: "Players glancing / release" },
  { id: "lift", name: "Shared lift and jump" },
  { id: "start-stop", name: "Remote start / stop" },
  { id: "reversal", name: "Quick left / right" },
];
export const NEUTRAL: PhysicsInput = { x: 0, z: 0, jump: false };
/** Same authored obstacle feeds the lab renderer and the physics scene. */
export function pairObstacles(scene: PairScenario): PhysicsShape[] {
  return scene === "player-jump"
    ? [
        {
          id: "player-stop",
          x: -14.62,
          y: 0,
          z: 0,
          width: 0.2,
          depth: 4,
          low: 4,
          high: 4,
          thickness: 4,
          color: 0x947a68,
        },
      ]
    : [];
}
export function setupPair(world: RapierWorld, scene: PairScenario) {
  const y = PLAYER_FOOT_OFFSET + 0.04;
  world.configurePair(
    scene === "player-land"
      ? [
          { x: -14.95, y: y + 2 * PLAYER_FOOT_OFFSET + 0.8, z: 0 },
          { x: -15, y, z: 0 },
        ]
      : scene === "player-stack"
        ? [
            { x: -15, y: y + 2 * PLAYER_FOOT_OFFSET + 0.02, z: 0 },
            { x: -15, y, z: 0 },
          ]
        : scene === "player-jump"
          ? [
              { x: -15.58, y, z: 0 },
              { x: -15, y, z: 0 },
            ]
          : scene === "lift"
            ? [
                { x: -3.65, y: y + 0.2, z: 6.5 },
                { x: -2.35, y: y + 0.2, z: 6.5 },
              ]
            : scene === "player-head-on" || scene === "player-glance" || scene === "player-push"
              ? [
                  { x: -16, y, z: 0 },
                  { x: -14, y, z: scene === "player-glance" ? 0.1 : 0 },
                ]
              : [
                  { x: -14, y, z: 0 },
                  { x: scene === "push-player" ? -11 : -10, y, z: 0 },
                ],
    scene === "lift" ||
      scene === "start-stop" ||
      scene === "player-head-on" ||
      scene === "player-glance" ||
      scene === "player-push" ||
      scene === "player-stack" ||
      scene === "player-land" ||
      scene === "player-jump"
      ? null
      : { x: -12.5, y: 0.42, z: 0 },
  );
  for (const shape of pairObstacles(scene)) {
    const collider = RAPIER.ColliderDesc.convexHull(slabVertices(shape));
    if (!collider) throw Error("Invalid pair obstacle");
    world.world.createCollider(collider.setTranslation(shape.x, shape.y, shape.z));
  }
}
/** Tick-addressed inputs, shared by visual playback and native tests. */
export function pairInput(scene: PairScenario, seat: PhysicsSeat, tick: number): PhysicsInput {
  if (scene === "player-land") return NEUTRAL;
  if (scene === "player-stack" || scene === "player-jump")
    return seat === 0 && tick >= 30 && tick < 90
      ? { x: 1, z: 0, jump: scene === "player-jump" && tick >= 45 && tick < 60 }
      : NEUTRAL;
  if (scene === "player-head-on" || scene === "player-glance" || scene === "player-push") {
    if (tick < 30 || tick >= 90) return NEUTRAL;
    return seat === 0
      ? { x: 1, z: 0, jump: false }
      : scene === "player-head-on"
        ? { x: -1, z: 0, jump: false }
        : NEUTRAL;
  }
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
