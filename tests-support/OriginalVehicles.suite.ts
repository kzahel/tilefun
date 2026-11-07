import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { PNG } from "pngjs";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { expect, it } from "vitest";
import { SPRITE_MANIFEST } from "../src/assets/GameAssets.js";
import { VEHICLE_PALETTE } from "../src/editor/EditorPalettes.js";
import { Direction } from "../src/entities/Entity.js";
import {
  authoredVehicleForType,
  vehicleMeshHeightScale,
} from "../src/rendering/AuthoredVehicleMeshes.js";
import { CarMeshAsset } from "../src/rendering/CarMeshAsset.js";
import { EntityMeshPose } from "../src/rendering/EntityMeshPose.js";
import { applyEntityDelta, diffEntitySnapshots } from "../src/shared/entityDelta.js";
import { required } from "../src/shared/required.js";
import { deserializeEntity, serializeEntity } from "../src/shared/serialization.js";
import { ORIGINAL_VEHICLES } from "../src/traffic/OriginalVehicles.js";
import {
  applyVehicleFacing,
  createVehicle,
  TRAFFIC_MODELS,
  VEHICLE_BANK,
  vehicleRoadWidth,
  vehicleTurningRadius,
} from "../src/traffic/Vehicle.js";
import { vehiclePerformance } from "../src/traffic/VehiclePerformance.js";
import meshBodies from "../src/traffic/vehicle-body-bounds.json" with { type: "json" };
import { AUTONOMOUS_ORIGINAL_VEHICLES } from "./AutonomousOriginalVehicles.fixture.js";
import { verifyOriginalWheelGeometryAndTravel } from "./AutonomousOriginalVehicles.test-helper.js";
import { readRetainedReplayInput } from "./RetainedReplayInputs.test-helper.js";
import { testPart } from "./TestParts.test-helper.js";

/** Per-model original vehicle asset cases for one `OriginalVehicles.partN.test.ts` slice. */
export function defineOriginalVehicleSuite(partFileUrl: string): void {
  it.each(testPart(AUTONOMOUS_ORIGINAL_VEHICLES, partFileUrl))(
    "ships $model reviewed mesh and exact game-camera fallback for every facing",
    (family) => {
      const definition = required(ORIGINAL_VEHICLES.find((vehicle) => vehicle.id === family.model));
      const [length, width, height] = family.bounds;
      const type = `vehicle-v1:${definition.id}`;
      const receipt = JSON.parse(readFileSync(family.receiptPath, "utf8"));
      const model = readFileSync(`public/${definition.mesh.path}`);
      expect(createHash("sha256").update(model).digest("hex")).toBe(receipt.modelSha256);
      for (const [path, expected] of Object.entries(receipt.inputs)) {
        expect(
          createHash("sha256")
            .update(readRetainedReplayInput(process.cwd(), path, expected as string))
            .digest("hex"),
          path,
        ).toBe(expected);
      }
      expect(authoredVehicleForType(type)?.path).toBe(
        family.model === "dump-truck"
          ? "assets/models/vehicles/dump-truck-v2.glb"
          : family.model === "tow-truck"
            ? "assets/models/vehicles/tow-truck-v2.glb"
            : definition.mesh.path,
      );
      expect(VEHICLE_BANK.views).toHaveLength(180);
      expect(TRAFFIC_MODELS).toContain(definition.id);
      expect(VEHICLE_PALETTE.find((entry) => entry.type === type)?.label).toBe(family.name);
      expect(SPRITE_MANIFEST.find((entry) => entry.key === type)?.path).toBe(definition.sprite);
      const sprite = readFileSync(`public/${definition.sprite}`);
      expect(createHash("sha256").update(sprite).digest("hex")).toBe(receipt.spriteSha256);
      const sheet = PNG.sync.read(sprite);
      expect([sheet.width, sheet.height]).toEqual([192, 896]);
      const expectedSheet = Buffer.alloc(sheet.data.length);
      const n = family.nativeSize;
      for (const [row, index] of [4, 12, 8, 0].entries()) {
        const frame = PNG.sync.read(readFileSync(`${family.captures}/engine-${index}.png`));
        expect([frame.width, frame.height]).toEqual([n, n]);
        for (let y = 0; y < n; y++) {
          for (let x = 0; x < n; x++) {
            const source = (y * n + x) * 4;
            if (!frame.data[source + 3]) continue;
            const dx = x + 96 - n / 2,
              dy = y + 144 - n / 2;
            // Only transparent margins may be cropped, including the bus's 224px viewport.
            expect(dx).toBeGreaterThanOrEqual(0);
            expect(dx).toBeLessThan(192);
            expect(dy).toBeGreaterThanOrEqual(0);
            expect(dy).toBeLessThan(224);
            frame.data.copy(expectedSheet, ((row * 224 + dy) * 192 + dx) * 4, source, source + 4);
          }
        }
        const view = required(definition.views[row]);
        const [x, y] = view.rect;
        const side = row >= 2;
        expect(view.metadata.anchor).toEqual([
          96 - required(x),
          144 + row * 224 - required(y) + (side ? width : length) / 2,
        ]);
      }
      expect(sheet.data).toEqual(expectedSheet);
      const body = meshBodies[family.model as keyof typeof meshBodies];
      const bodyLength = Math.max(length, body?.length ?? 0),
        bodyWidth = Math.max(width, body?.breadth ?? 0);
      for (const facing of [Direction.Down, Direction.Up, Direction.Left, Direction.Right]) {
        const car = createVehicle(definition.id, 120, 240, facing);
        expect(car.collider?.physicalHeight).toBe(height);
        expect([car.collider?.width, car.collider?.height]).toEqual(
          facing === Direction.Left || facing === Direction.Right
            ? [bodyLength, bodyWidth]
            : [bodyWidth, bodyLength],
        );
        expect(deserializeEntity(serializeEntity(car)).collider).toEqual(car.collider);
        expect(car.sprite?.frameRow).toBe(facing);
        const snapshot = serializeEntity(car);
        const client = deserializeEntity(snapshot);
        applyVehicleFacing(car, facing === Direction.Right ? Direction.Up : Direction.Right);
        applyEntityDelta(client, required(diffEntitySnapshots(snapshot, serializeEntity(car))));
        expect(client.collider).toEqual(car.collider);
        expect(client.sprite?.frameRow).toBe(car.sprite?.frameRow);
      }
      expect(vehicleRoadWidth(type)).toBe(width * 2 + 12);
      expect(vehicleTurningRadius(type)).toBeCloseTo(Math.max(40, length * 0.7));
      expect(vehiclePerformance(type).speed).toBe(family.performance.speed);
      expect(authoredVehicleForType(type)?.lateralScale).toBe(1);
      expect(vehicleMeshHeightScale(family.model)).toBe(1);
      const car = createVehicle(family.model, 120, 240, Direction.Down);
      expect(new EntityMeshPose().evaluate(car, 1)).toMatchObject({
        // Historical v1 receipt above stays frozen; active equipment uses the separately qualified v2 rig.
        assetId:
          family.model === "dump-truck"
            ? "dump-truck-authored-v2"
            : family.model === "tow-truck"
              ? "tow-truck-authored-v2"
              : definition.mesh.assetId,
        radius:
          family.model === "dump-truck"
            ? 128
            : family.model === "tow-truck"
              ? 144
              : family.nativeSize / 2,
      });
    },
  );
  it.each(testPart(AUTONOMOUS_ORIGINAL_VEHICLES, partFileUrl))(
    "decodes $model geometry, native scale, centered collider and embedded atlas independently",
    async (family) => {
      const definition = required(ORIGINAL_VEHICLES.find((vehicle) => vehicle.id === family.model));
      const model = readFileSync(`public/${definition.mesh.path}`);
      expect(createHash("sha256").update(model).digest("hex")).toBe(family.modelSha256);
      expect(model).toEqual(readFileSync(family.reviewModel));
      expect(model.byteLength).toBe(family.modelBytes);
      expect(definition.mesh).toEqual({
        assetId: family.assetId,
        path: family.modelPath,
        radius: family.nativeSize / 2,
        lateralScale: 1,
      });
      expect(definition.sprite).toBe(family.spritePath);
      // Only image decoding is replaced in Node. Production GLTFLoader/CarMeshAsset
      // still decode the actual geometry and transforms; embedded image bytes follow.
      const loader = new GLTFLoader();
      loader.register(() => ({
        name: "node-texture",
        loadTexture: async () => new THREE.Texture(),
      }));
      const gltf = await loader.parseAsync(
        model.buffer.slice(model.byteOffset, model.byteOffset + model.byteLength),
        "",
      );
      const asset = new CarMeshAsset(gltf.scene, definition.mesh.lateralScale, {
        batch: true,
        heightScale: vehicleMeshHeightScale(definition.id),
      });
      try {
        asset.object.updateMatrixWorld(true);
        const bounds = new THREE.Box3().setFromObject(asset.object, true);
        const size = bounds.getSize(new THREE.Vector3()).toArray();
        const [length, width, height] = family.bounds;
        expect(bounds.min.z).toBeCloseTo(0, 5);
        // The immutable historical coupe protrudes 0.0404px laterally. New
        // originals have no origin tolerance: their collider encloses every vertex.
        expect(family.originTolerance).toBe(family.model === "rosso-coupe" ? 0.041 : 0);
        const legacyTolerance = family.originTolerance;
        for (const [axis, limit] of [
          ["x", length / 2],
          ["y", width / 2],
        ] as const) {
          expect(bounds.min[axis]).toBeGreaterThanOrEqual(-limit - legacyTolerance - 0.00001);
          expect(bounds.max[axis]).toBeLessThanOrEqual(limit + legacyTolerance + 0.00001);
        }
        expect(bounds.max.z).toBeLessThanOrEqual(height);
        // Asymmetric equipment can have a smaller span than its origin-centered
        // collider. Compare decoded extents to independent measured literals so
        // neither a shifted origin nor inflated metadata can mask a scale change.
        if ("actualOriginExtents" in family) {
          const extents = [
            2 * Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x)),
            2 * Math.max(Math.abs(bounds.min.y), Math.abs(bounds.max.y)),
            bounds.max.z,
          ];
          extents.forEach((value, axis) => {
            expect(value).toBeCloseTo(required(family.actualOriginExtents[axis]), 4);
            expect(value).toBeLessThanOrEqual(required(family.bounds[axis]) + 0.00001);
            expect(value).toBeGreaterThan(required(family.bounds[axis]) - 1 - 0.00001);
          });
        } else {
          size.forEach((value, axis) => {
            expect(value).toBeGreaterThan(required(family.bounds[axis]) - 2);
          });
        }
        expect(asset.meshCount).toBe(family.meshCount);
        expect(asset.drawMeshCount).toBe(family.meshCount);
        expect(Object.keys(family.wheelRadii)).toEqual([...family.wheelIds]);
        verifyOriginalWheelGeometryAndTravel(asset, family.wheelRadii);
        const json = gltf.parser.json;
        const primitives = json.meshes.flatMap(
          (mesh: { primitives: { indices: number }[] }) => mesh.primitives,
        );
        expect(primitives).toHaveLength(family.primitiveCount);
        expect(
          primitives.reduce(
            (sum: number, primitive: { indices: number }) =>
              sum + json.accessors[primitive.indices].count / 3,
            0,
          ),
        ).toBe(family.triangles);
        expect(json.materials).toHaveLength(1);
        expect(json.materials[0].extensions).toHaveProperty("KHR_materials_unlit");
        expect(json.materials[0].alphaMode ?? "OPAQUE").toBe("OPAQUE");
        expect(json.images).toHaveLength(1);
        const atlasView = json.bufferViews[json.images[0].bufferView];
        const binaryOffset = 20 + model.readUInt32LE(12) + 8;
        const atlasBytes = model.subarray(
          binaryOffset + atlasView.byteOffset,
          binaryOffset + atlasView.byteOffset + atlasView.byteLength,
        );
        expect(atlasBytes).toEqual(readFileSync(family.reviewAtlas));
        const atlas = PNG.sync.read(atlasBytes);
        expect([atlas.width, atlas.height]).toEqual([512, 512]);
      } finally {
        asset.dispose();
      }
      const receipt = JSON.parse(readFileSync(family.receiptPath, "utf8"));
      expect(receipt.physicalBounds).toEqual(family.bounds);
      if (receipt.measurement) {
        expect(receipt.measurement.modelSha256).toBe(family.modelSha256);
        expect(receipt.measurement.triangles).toBe(family.triangles);
        expect(receipt.measurement.meshes).toBe(family.meshCount);
        expect(receipt.capture).toEqual({
          frameSize: [family.nativeSize, family.nativeSize],
          groundOrigin: [family.nativeSize / 2, family.nativeSize / 2],
          cardinals: { south: 4, north: 12, west: 8, east: 0 },
        });
        expect(receipt.sourceOnlyReplay).toMatchObject({
          byteIdentical: true,
          scratchInputDependencies: [],
        });
        const replay = JSON.parse(readFileSync(receipt.sourceOnlyReplay.receipt, "utf8"));
        for (const [path, hash] of Object.entries({
          ...replay.inputHashes,
          ...replay.sharedInputHashes,
        })) {
          expect(path).not.toMatch(/^(?:data|test-results)\//);
          expect(
            createHash("sha256")
              .update(readRetainedReplayInput(process.cwd(), path, hash as string))
              .digest("hex"),
            path,
          ).toBe(hash);
        }
      }
      for (const path of Object.keys(receipt.inputs))
        expect(path).not.toMatch(/^(?:data|test-results)\//);
      expect(vehiclePerformance(`vehicle-v1:${family.model}`)).toEqual(family.performance);
    },
  );
}
