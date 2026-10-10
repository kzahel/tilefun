import { expect, it } from "vitest";
import { LocalTransport } from "../transport/LocalTransport.js";
import { nextInputSequence, observeInputSequence } from "./InputSequence.js";

it("preserves submitted sequences across scene replacement, cancellation and old acknowledgements", () => {
  const connection = new LocalTransport().clientSide;
  expect(nextInputSequence(connection)).toBe(1);
  expect(nextInputSequence(connection)).toBe(2);
  observeInputSequence(connection, 1); // replacement scene sees a delayed acknowledgement
  expect(nextInputSequence(connection)).toBe(3); // cancellation
  expect(nextInputSequence(connection, 0)).toBe(4); // first live input in replacement scene
});

it("seeds a replacement client from authority while keeping connections independent", () => {
  const connection = new LocalTransport().clientSide;
  observeInputSequence(connection, 200);
  expect(nextInputSequence(connection)).toBe(201);
  expect(nextInputSequence(new LocalTransport().clientSide)).toBe(1);
});
