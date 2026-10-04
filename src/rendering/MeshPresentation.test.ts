import { expect, it, vi } from "vitest";
import { COMPACT_CAR_MESH, resolveBody, yawOrientation } from "./MeshPresentation.js";
import { ResourceSlot } from "./ResourceSlot.js";

it("resolves exactly one body without changing the complete sprite fallback", () => {
  const mesh = { assetId: COMPACT_CAR_MESH, orientation: yawOrientation(Math.PI / 3), radius: 64 };
  const before = JSON.stringify(mesh);
  expect(resolveBody(mesh, new Set())).toBe("sprite");
  expect(resolveBody(mesh, new Set([COMPACT_CAR_MESH]))).toBe("mesh");
  expect(resolveBody(undefined, new Set([COMPACT_CAR_MESH]))).toBe("sprite");
  expect(JSON.stringify(mesh)).toBe(before);
  expect(Math.hypot(...mesh.orientation)).toBeCloseTo(1);
});
it("retires async results after replacement and disposal", async () => {
  const slot = new ResourceSlot<{ dispose: () => void }>();
  let resolve: (value: { dispose: () => void }) => void = () => {};
  const stale = { dispose: vi.fn() },
    current = { dispose: vi.fn() };
  const pending = slot.load(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  await slot.load(async () => current);
  resolve(stale);
  await pending;
  expect(stale.dispose).toHaveBeenCalledOnce();
  expect(slot.value).toBe(current);
  slot.dispose();
  slot.dispose();
  expect(current.dispose).toHaveBeenCalledOnce();
  expect(slot.state).toBe("disposed");
});
it("failed loads preserve fallback and may retry", async () => {
  const slot = new ResourceSlot<{ dispose: () => void }>();
  await slot.load(async () => {
    throw Error("missing asset");
  });
  expect(slot.state).toBe("failed");
  expect(slot.value).toBeNull();
  await slot.load(async () => ({ dispose() {} }));
  expect(slot.state).toBe("ready");
  slot.dispose();
});
