import { expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { curvedTrainRecipe } from "../scenarios/CurvedTrainRecipe.js";
import { applyEntityDelta, diffEntitySnapshots } from "../shared/entityDelta.js";
import { deserializeEntity, serializeEntity } from "../shared/serialization.js";
import { createCurveTrain } from "./CurveTrain.js";
import { carriagePose, RailAlignment, segmentLength } from "./RailPath.js";

const path = (loop = true) => required(required(curvedTrainRecipe(loop).railways)[0]?.path);
it("joins straights and arcs tangentially and wraps the loop without a seam", () => {
  const a = new RailAlignment(path());
  let distance = 0;
  for (const s of a.path.segments) {
    distance += segmentLength(s);
    const p = a.sample(distance - 0.001),
      q = a.sample(distance + 0.001);
    expect(Math.hypot(p.x - q.x, p.y - q.y)).toBeCloseTo(0.002, 5);
    expect(Math.cos(p.angle - q.angle)).toBeCloseTo(1, 8);
  }
  expect(a.sample(-112)).toEqual(a.sample(a.length - 112));
  const before = carriagePose(a, a.length - 0.001),
    after = carriagePose(a, 0.001);
  expect(Math.hypot(before.x - after.x, before.y - after.y)).toBeLessThan(0.003);
});
it("rejects tight curves, disconnected track, tangent jumps and invalid stations", () => {
  for (const change of ["radius", "gap", "tangent", "station"] as const) {
    const p = path();
    const arc = p.segments[1];
    if (arc?.kind !== "arc") throw Error("arc missing");
    if (change === "radius") arc.radius = 32;
    if (change === "gap") arc.x += 1;
    if (change === "tangent") arc.sweep = -arc.sweep;
    if (change === "station") p.stops[1] = { name: "Too close", distance: 400 };
    expect(() => new RailAlignment(p)).toThrow();
  }
});
it("replicates stopped diagonal orientation and reconstructs matching collision through snapshots and deltas", () => {
  const a = new RailAlignment(path());
  const first = required(createCurveTrain(a, 800)[1]),
    next = required(createCurveTrain(a, 1000)[1]);
  const replica = deserializeEntity(serializeEntity(first));
  expect(replica.collider).toEqual(first.collider);
  const delta = diffEntitySnapshots(serializeEntity(first), serializeEntity(next));
  if (!delta) throw Error("missing orientation delta");
  applyEntityDelta(replica, delta);
  expect(replica.collider).toEqual(next.collider);
  expect(replica.sprite?.frameRow).toBe(next.sprite?.frameRow);
  expect(next.sprite?.frameRow).not.toBe(0);
});
