import { describe, expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { Direction } from "../entities/Entity.js";
import { decodeServerMessage, encodeServerMessage } from "../shared/binaryCodec.js";
import { applyEntityDelta, diffEntitySnapshots } from "../shared/entityDelta.js";
import type { FrameMessage } from "../shared/protocol.js";
import {
  deserializeEntity,
  reuseEntitySnapshot,
  serializeEntity,
} from "../shared/serialization.js";
import { createVehicle } from "./Vehicle.js";
import {
  paintFromWire,
  paintWireIndex,
  trafficPaint,
  VEHICLE_PAINT_IDS,
  VEHICLE_PAINTS,
  vehiclePaintSchemes,
} from "./VehiclePaint.js";

describe("vehicle paint authority and transport", () => {
  it("roundtrips every family/scheme through binary baselines, deltas, removal and derived sprites", () => {
    for (const [model, family] of Object.entries(VEHICLE_PAINTS.families)) {
      for (const scheme of family.schemes) {
        const original = createVehicle(model, 10, 20, Direction.Left);
        const painted = createVehicle(model, 10, 20, Direction.Left, scheme.id);
        const baseline = serializeEntity(painted);
        const frame: FrameMessage = {
          type: "frame",
          serverTick: 1,
          simulationTime: 1,
          lastProcessedInputSeq: 0,
          playerEntityId: 0,
          entityBaselines: [baseline],
        };
        const decoded = decodeServerMessage(encodeServerMessage(frame)) as FrameMessage;
        const restored = deserializeEntity(required(decoded.entityBaselines?.[0]));
        expect(restored.paintSchemeId).toBe(scheme.id);
        expect(restored.sprite?.sheetKey).toBe(`vehicle-v1:${model}:paint:${scheme.id}`);
        expect(reuseEntitySnapshot(painted, baseline)).toBe(baseline);
        delete painted.paintSchemeId;
        expect(reuseEntitySnapshot(painted, baseline)).not.toBe(baseline);
        const delta = required(diffEntitySnapshots(serializeEntity(original), baseline));
        const deltaFrame = decodeServerMessage(
          encodeServerMessage({ ...frame, entityBaselines: [], entityDeltas: [delta] }),
        ) as FrameMessage;
        applyEntityDelta(original, required(deltaFrame.entityDeltas?.[0]));
        expect(original.paintSchemeId).toBe(scheme.id);
        expect(original.sprite?.sheetKey).toBe(restored.sprite?.sheetKey);
        const remove = required(diffEntitySnapshots(baseline, serializeEntity(painted)));
        expect(remove.paintSchemeId).toBe(null);
        const clear = decodeServerMessage(
          encodeServerMessage({ ...frame, entityBaselines: [], entityDeltas: [remove] }),
        ) as FrameMessage;
        applyEntityDelta(original, required(clear.entityDeltas?.[0]));
        expect(original.paintSchemeId).toBeUndefined();
        expect(original.sprite?.sheetKey).toBe(original.type);
      }
    }
  });
  it("rejects unknown and wrong-family paint while preserving old/default cars", () => {
    expect(() => createVehicle("beetle", 0, 0, Direction.Right, "navy-stripes")).toThrow();
    expect(() => createVehicle("compact-1", 0, 0, Direction.Right, "cherry")).toThrow();
    expect(createVehicle("beetle", 0, 0).paintSchemeId).toBeUndefined();
    for (const id of VEHICLE_PAINT_IDS) expect(paintFromWire(paintWireIndex(id))).toBe(id);
    expect(() => paintWireIndex("invented")).toThrow();
    expect(() => paintFromWire(255)).toThrow();
    expect(() => decodeServerMessage(new Uint8Array([0x04]).buffer)).toThrow("matching updated");
  });
  it("chooses stable weighted traffic colors, including defaults and every owned scheme", () => {
    for (const model of Object.keys(VEHICLE_PAINTS.families)) {
      const seen = new Set<string | undefined>();
      for (let i = 0; i < 300; i++) {
        const id = `lane:${i}`;
        const paint = trafficPaint(model, id);
        expect(trafficPaint(model, id)).toBe(paint);
        seen.add(paint);
      }
      expect(seen).toEqual(new Set([undefined, ...vehiclePaintSchemes(model).map((p) => p.id)]));
    }
    expect(trafficPaint("compact-1", "anything")).toBeUndefined();
  });
});
