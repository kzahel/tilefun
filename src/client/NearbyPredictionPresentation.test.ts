import { expect, it } from "vitest";
import type { Entity } from "../entities/Entity.js";
import { createPlayer } from "../entities/Player.js";
import { PHYSICS_DT } from "../physics/PhysicsDefaults.js";
import { required } from "../shared/required.js";
import { NearbyPredictionPresentation } from "./NearbyPredictionPresentation.js";

it("keeps the solved pose on contact and settles the released actor during sliced replay", () => {
  const presentation = new NearbyPredictionPresentation();
  const id = 1;
  const speed = 128;
  const lead = 6;
  let now = 0;
  const actor = (x: number): Entity => ({
    ...createPlayer(x, 0),
    id,
    prevPosition: { wx: x - speed * PHYSICS_DT, wy: 0 },
    velocity: { vx: speed, vy: 0 },
  });
  function draw(selected: boolean, inContact: boolean, replay = false) {
    const buffer = actor(now * speed);
    const predicted = actor(buffer.position.wx + lead);
    const shown = presentation.present(
      [buffer],
      new Map(selected ? [[id, predicted]] : []),
      now,
      replay
        ? undefined
        : {
            bodies: new Map([[id, predicted]]),
            local: new Set(),
            alpha: 1,
            inContact: () => inContact,
          },
    );
    return required(shown[0]).position.wx - buffer.position.wx;
  }
  expect(draw(true, false)).toBe(0);
  now += PHYSICS_DT;
  expect(draw(true, true)).toBeCloseTo(lead);
  now += PHYSICS_DT;
  expect(draw(true, false)).toBeCloseTo(lead); // Separating while still close.
  now += PHYSICS_DT;
  expect(draw(false, false)).toBeCloseTo(lead);
  now += PHYSICS_DT;
  const releasing = draw(false, false, true);
  expect(releasing).toBeGreaterThan(0);
  expect(releasing).toBeLessThan(lead);
  now += 0.2;
  expect(draw(false, false, true)).toBe(0);
});
