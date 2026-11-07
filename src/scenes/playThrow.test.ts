import { expect, it } from "vitest";
import { Direction } from "../entities/Entity.js";
import { throwDirection } from "./playThrow.js";

it("aims along movement, then the first-person look, then the sprite facing", () => {
  expect(throwDirection({ dx: 3, dy: 4 }, Direction.Left, { x: 1, y: 0 })).toEqual({
    dirX: 0.6,
    dirY: 0.8,
  });
  expect(throwDirection({ dx: 0, dy: 0 }, Direction.Left, { x: 0, y: -1 })).toEqual({
    dirX: 0,
    dirY: -1,
  });
  expect(throwDirection({ dx: 0, dy: 0 }, Direction.Left)).toEqual({ dirX: -1, dirY: 0 });
  expect(throwDirection({ dx: 0, dy: 0 }, Direction.Up)).toEqual({ dirX: 0, dirY: -1 });
  expect(throwDirection({ dx: 0, dy: 0 }, undefined)).toEqual({ dirX: 0, dirY: 1 });
});
