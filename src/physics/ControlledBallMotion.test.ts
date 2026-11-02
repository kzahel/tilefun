import { expect, it } from "vitest";
import { BOUNCE_RESTITUTION } from "../config/constants.js";
import { createBall } from "../entities/Ball.js";
import { EntityManager } from "../entities/EntityManager.js";
import { controlledBallMotion } from "./ControlledBallMotion.js";
import { getMovementPhysicsParams } from "./PlayerMovement.js";

it("accumulates orthogonal ball reflections instead of restoring the first incoming component", () => {
  const ball = createBall(0, 0);
  ball.jumpVZ = 1;
  ball.velocity = { vx: 30, vy: 40 };
  controlledBallMotion(
    ball,
    1 / 60,
    {
      getCollision: () => 0,
      getHeight: () => 0,
      isEntityBlocked: () => false,
      isPropBlocked: () => false,
      noclip: false,
      moveCharacter: () => ({
        landed: false,
        groundZ: 0,
        collisionNormals: [
          { x: -1, y: 0, z: 0 },
          { x: 0, y: 0, z: -1 },
        ],
      }),
    },
    getMovementPhysicsParams(),
    new EntityManager(),
  );
  expect(ball.velocity.vx).toBeCloseTo(-30 * BOUNCE_RESTITUTION, 5);
  expect(ball.velocity.vy).toBeCloseTo(-40 * BOUNCE_RESTITUTION, 5);
});
