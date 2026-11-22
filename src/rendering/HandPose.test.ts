import { expect, it } from "vitest";
import { Direction } from "../entities/Entity.js";
import { AXE, CORN, countHandUse, HAND_FRAME, setHandItem } from "../inventory/Inventory.js";
import { handFrame, USE_POSE_SECONDS } from "./HandPose.js";

it("starts a use pose only when the replicated counter changes after the body was seen", () => {
  const body: { id: number; hand?: number } = { id: 1 };
  setHandItem(body, AXE);
  countHandUse(body);
  // Presentation hands out a fresh object per snapshot; the pose follows the entity id.
  const copy = () => ({ ...body });
  // Streaming a player in with an old count does not replay that swing.
  expect(handFrame(copy(), Direction.Right, 10)).toMatchObject({ column: AXE - 1, row: 0, dx: 0 });
  countHandUse(body);
  expect(handFrame(copy(), Direction.Right, 10)).toMatchObject({ row: 1, lift: 3 });
  expect(handFrame(copy(), Direction.Right, 10.2)).toMatchObject({ row: 2, dx: 0, lift: 0 });
  expect(handFrame(copy(), Direction.Left, 10.25)).toMatchObject({ row: 2, flipX: true });
  expect(handFrame(copy(), Direction.Right, 10 + USE_POSE_SECONDS)).toMatchObject({ row: 0 });
});

it("waves a glove for an empty hand and keeps corn's carried art unflipped", () => {
  const body: { id: number; hand?: number } = { id: 2 };
  expect(handFrame(body, Direction.Down, 0)).toBeUndefined();
  countHandUse(body);
  expect(handFrame(body, Direction.Down, 1)).toMatchObject({ column: HAND_FRAME, lift: 3 });
  expect(handFrame(body, Direction.Down, 1 + USE_POSE_SECONDS)).toBeUndefined();
  setHandItem(body, CORN);
  expect(handFrame(body, Direction.Left, 2)).toMatchObject({ column: CORN - 1, flipX: false });
});
