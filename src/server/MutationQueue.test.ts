import { expect, it } from "vitest";
import { MutationQueue } from "./MutationQueue.js";

it("orders edits behind readiness, bounds queued work, and drains rejected commands", async () => {
  const queue = new MutationQueue();
  let release = () => {};
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });
  const applied: number[] = [];
  const first = queue.run(
    false,
    () => ready,
    () => {
      applied.push(0);
    },
  );
  const rest = Array.from({ length: 63 }, (_, i) =>
    queue.run(
      true,
      async () => {},
      () => {
        applied.push(i + 1);
      },
    ),
  );
  expect(() =>
    queue.run(
      true,
      async () => {},
      () => {},
    ),
  ).toThrow(/Too many/);
  expect(applied).toEqual([]);
  release();
  await Promise.all([first, ...rest]);
  await queue.drain();
  expect(applied).toEqual(Array.from({ length: 64 }, (_, i) => i));
  expect(queue.count).toBe(0);
  await expect(
    queue.run(
      false,
      async () => {
        throw Error("read failed");
      },
      () => {
        applied.push(-1);
      },
    ),
  ).rejects.toThrow("read failed");
  await queue.drain();
  queue.run(
    true,
    async () => {},
    () => {
      applied.push(64);
    },
  );
  expect(applied.at(-1)).toBe(64);
});
