import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
// @ts-expect-error pngjs has no bundled declarations
import { PNG } from "pngjs";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { SPRITE_MANIFEST } from "../assets/GameAssets.js";
import { RemoteStateView } from "../client/ClientStateView.js";
import { VEHICLE_PALETTE } from "../editor/EditorPalettes.js";
import { Direction } from "../entities/Entity.js";
import { createPlayer } from "../entities/Player.js";
import {
  AUTHORED_VEHICLE_MESHES,
  authoredVehicleForType,
  vehicleMeshHeightScale,
} from "../rendering/AuthoredVehicleMeshes.js";
import { CarMeshAsset } from "../rendering/CarMeshAsset.js";
import { EntityMeshPose } from "../rendering/EntityMeshPose.js";
import { FLAT_SCENARIO } from "../scenarios/ScenarioRecipe.js";
import { ScenarioSession } from "../scenarios/ScenarioSession.js";
import { decodeServerMessage } from "../shared/binaryCodec.js";
import { applyEntityDelta, diffEntitySnapshots } from "../shared/entityDelta.js";
import { deserializeEntity, serializeEntity } from "../shared/serialization.js";
import { World } from "../world/World.js";
import { AUTONOMOUS_ORIGINAL_VEHICLES } from "./AutonomousOriginalVehicles.fixture.js";
import { verifyOriginalWheelGeometryAndTravel } from "./AutonomousOriginalVehicles.test-helper.js";
import { ORIGINAL_VEHICLES } from "./OriginalVehicles.js";
import { readRetainedReplayInput } from "./RetainedReplayInputs.test-helper.js";
import { TrafficTestHarness } from "./TrafficTestHarness.js";
import { TRANSPORTER_EXPECTATIONS } from "./Transporter.fixture.js";
import {
  applyVehicleFacing,
  createVehicle,
  DRIVABLE_MODELS,
  TRAFFIC_MODELS,
  VEHICLE_BANK,
  VEHICLE_MODELS,
  vehicleRoadWidth,
  vehicleTurningRadius,
} from "./Vehicle.js";
import { vehiclePerformance } from "./VehiclePerformance.js";
import meshBodies from "./vehicle-body-bounds.json" with { type: "json" };

it.each(AUTONOMOUS_ORIGINAL_VEHICLES)(
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

it("covers every active original with independent frozen expectations", () => {
  expect(ORIGINAL_VEHICLES.map((vehicle) => vehicle.id).sort()).toEqual(
    [
      ...AUTONOMOUS_ORIGINAL_VEHICLES.map((family) => family.model),
      TRANSPORTER_EXPECTATIONS.model,
    ].sort(),
  );
  for (const key of ["assetId", "modelPath", "spritePath", "modelSha256"] as const) {
    expect(new Set(AUTONOMOUS_ORIGINAL_VEHICLES.map((family) => family[key])).size).toBe(
      AUTONOMOUS_ORIGINAL_VEHICLES.length,
    );
  }
});

it("registers every combined model exactly once across editor, assets, traffic and own meshes", () => {
  expect(VEHICLE_MODELS).toHaveLength(
    new Set(VEHICLE_BANK.views.map((view) => view.vehicleId)).size + ORIGINAL_VEHICLES.length,
  );
  expect(new Set(VEHICLE_MODELS).size).toBe(VEHICLE_MODELS.length);
  expect(TRAFFIC_MODELS).toHaveLength(VEHICLE_MODELS.length - 1);
  expect(AUTHORED_VEHICLE_MESHES).toHaveLength(DRIVABLE_MODELS.length);
  for (const model of DRIVABLE_MODELS) {
    const type = `vehicle-v1:${model}`;
    expect(VEHICLE_PALETTE.filter((entry) => entry.type === type)).toHaveLength(1);
    expect(SPRITE_MANIFEST.filter((entry) => entry.key === type)).toHaveLength(1);
    expect(AUTHORED_VEHICLE_MESHES.filter((entry) => entry.vehicle === model)).toHaveLength(1);
  }
});

it.each([...AUTONOMOUS_ORIGINAL_VEHICLES, TRANSPORTER_EXPECTATIONS])(
  "admits $model through ordinary generated-road traffic selection",
  ({ model, bounds }) => {
    const roadWidth = bounds[1] * 2 + 12;
    const scene = new TrafficTestHarness();
    for (const state of [...scene.traffic.states.values()])
      scene.entities.remove(state.entity.id, false);
    // Isolate the target identity while retaining production lane selection,
    // deterministic model choice, width admission and collision checks.
    const graph = scene.strategy.trafficNetwork(4800, 8304);
    const positions = [
      { x: 4800, y: 8304 },
      ...[...graph.lanes.values()].slice(0, 64).map((lane) => lane.a),
      // Roster growth changes selector modulo; cover a bounded real-world grid.
      ...Array.from({ length: 33 }, (_, i) => (i - 16) * 4096).flatMap((dx) =>
        Array.from({ length: 33 }, (_, i) => ({ x: 4800 + dx, y: 8304 + (i - 16) * 4096 })),
      ),
    ];
    let productionCandidates = 0;
    for (const position of positions) {
      scene.player.position = { wx: position.x, wy: position.y };
      const cx = Math.floor(position.x / 256),
        cy = Math.floor(position.y / 256);
      scene.traffic.visibleRanges = [{ minCx: cx, maxCx: cx, minCy: cy, maxCy: cy }];
      // Probe the ordinary deterministic selector before loading terrain. This
      // stays bounded as future entries change its modulo and chosen identities.
      const candidates: { wx: number; wy: number }[] = [];
      scene.traffic.canSpawn = (identity, wx, wy) => {
        if (identity.includes(`:${model}:`)) candidates.push({ wx, wy });
        return false;
      };
      scene.traffic.tick(2.1, [scene.player]);
      productionCandidates += candidates.length;
      if (!candidates.length) continue;
      for (const point of candidates) {
        const px = Math.floor(point.wx / 256),
          py = Math.floor(point.wy / 256);
        for (let y = py - 2; y <= py + 2; y++)
          for (let x = px - 2; x <= px + 2; x++) scene.world.getChunk(x, y);
      }
      scene.traffic.canSpawn = (identity) => identity.includes(`:${model}:`);
      scene.traffic.tick(2.1, [scene.player]);
      if (scene.traffic.states.size) break;
    }
    const car = required(
      [...scene.traffic.states.values()][0],
      `No ${model} after ${positions.length} generated positions and ${productionCandidates} production candidates`,
    );
    expect(car.entity.type).toBe(`vehicle-v1:${model}`);
    expect(car.placed).not.toBe(true);
    expect(car.lane.width).toBeGreaterThanOrEqual(roadWidth);
    expect(car.entity.proceduralId).toContain("traffic-v1:");
  },
  20_000,
);

it("preserves the exact 45-type source bank", () => {
  expect(
    createHash("sha256").update(readFileSync("src/traffic/vehicles-v1.json")).digest("hex"),
  ).toBe("79cc6b59a727101304bde0beb7fe7e810703f3037ab9fcd4260334c55d8bf4c6");
  expect(new Set(VEHICLE_BANK.views.map((view) => view.vehicleId)).size).toBe(45);
});

it.each(AUTONOMOUS_ORIGINAL_VEHICLES)(
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
    loader.register(() => ({ name: "node-texture", loadTexture: async () => new THREE.Texture() }));
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

it.each(AUTONOMOUS_ORIGINAL_VEHICLES)(
  "excludes $model from undersized roads with a live population control",
  ({ model, bounds }) => {
    const roadWidth = bounds[1] * 2 + 12;
    const scene = new TrafficTestHarness();
    for (const state of [...scene.traffic.states.values()])
      scene.entities.remove(state.entity.id, false);
    const graph = scene.strategy.trafficNetwork(4800, 8304);
    const originalWidths = new Map([...graph.lanes.values()].map((lane) => [lane.id, lane.width]));
    // Hold this generated region fixed while exercising the public population path.
    scene.strategy.trafficNetwork = () => graph;
    for (const lane of graph.lanes.values()) lane.width = Math.min(lane.width, roadWidth - 1);
    const considered: string[] = [];
    scene.traffic.canSpawn = (identity) => {
      considered.push(identity);
      return true;
    };
    const populate = () => {
      for (const position of [
        { x: 4800, y: 8304 },
        ...[...graph.lanes.values()].slice(0, 12).map((lane) => lane.a),
      ]) {
        scene.player.position = { wx: position.x, wy: position.y };
        const cx = Math.floor(position.x / 256),
          cy = Math.floor(position.y / 256);
        for (let y = cy - 7; y <= cy + 7; y++)
          for (let x = cx - 7; x <= cx + 7; x++) scene.world.getChunk(x, y);
        scene.traffic.visibleRanges = [{ minCx: cx, maxCx: cx, minCy: cy, maxCy: cy }];
        scene.traffic.tick(2.1, [scene.player]);
      }
    };
    populate();
    expect(considered.some((identity) => identity.includes(`:${model}:`))).toBe(false);
    const cars = [...scene.traffic.states.values()];
    expect(
      cars.every((car) => car.lane.width < roadWidth && car.entity.type !== `vehicle-v1:${model}`),
    ).toBe(true);
    if (roadWidth <= 80) {
      // The shared population prefilter requires an 80px onward route before
      // model selection. A sub-74px microcar road therefore admits no model.
      // Restore the same real network to prove the negative used a live path.
      expect(considered).toHaveLength(0);
      expect(cars).toHaveLength(0);
      for (const lane of graph.lanes.values()) lane.width = required(originalWidths.get(lane.id));
      populate();
      expect(considered.length).toBeGreaterThan(0);
      expect(scene.traffic.states.size).toBeGreaterThan(0);
    } else {
      expect(considered.length).toBeGreaterThan(0);
      expect(cars.length).toBeGreaterThan(0);
    }
  },
);

it.each(AUTONOMOUS_ORIGINAL_VEHICLES)(
  "places, boards, drives, reloads and deletes $model through production Realm persistence",
  async (family) => {
    const idle = { dx: 0, dy: 0, jump: false, sprinting: false };
    const session = await ScenarioSession.create({
      version: 1,
      id: `original-${family.model}`,
      generation: FLAT_SCENARIO,
      player: createPlayer(0, 0),
      props: [],
    });
    try {
      session.player.editorEnabled = true;
      session.realm.handleMessage(session.player.clientId, session.player, {
        type: "edit-spawn",
        entityType: `vehicle-v1:${family.model}`,
        wx: 160,
        wy: 0,
      });
      const car = required([...required(session.realm.traffic).states.values()][0]);
      const identity = car.entity.proceduralId;
      expect(identity).toMatch(/^placed-vehicle-v1:/);
      expect(car.placed).toBe(true);
      session.player.editorEnabled = false;
      session.player.player.position = { wx: 160, wy: -16 };
      session.realm.vehicles.enter(session.player, car.entity.id);
      expect(session.player.player.parentId).toBe(car.entity.id);
      // Slow work vehicles retain the same meaningful 80px movement target.
      // Four seconds bounds the production-input control without inflating speed.
      for (let i = 0; i < 240 && car.entity.position.wx <= 240; i++)
        await session.step({ ...idle, dx: 1 });
      expect(car.entity.position.wx).toBeGreaterThan(240);
      const straight = car.entity.vehicleHeading ?? 0;
      for (let i = 0; i < 240 && (car.entity.vehicleHeading ?? 0) > straight - 0.35; i++)
        await session.step({ ...idle, dy: -1 });
      expect(car.entity.vehicleHeading).toBeLessThan(straight - 0.3);
      const forward = required(car.entity.vehicleHeading);
      for (let i = 0; i < 240 && (car.entity.vehicleHeading ?? 0) < forward + 0.25; i++)
        await session.step({ ...idle, dy: -1, reversing: true });
      expect(car.entity.vehicleHeading).toBeGreaterThan(forward + 0.2);
      for (let i = 0; i < 60; i++) await session.step(idle);
      expect(Math.hypot(car.entity.velocity?.vx ?? 0, car.entity.velocity?.vy ?? 0)).toBe(0);
      const stopped = { position: { ...car.entity.position }, heading: car.entity.vehicleHeading };
      for (let i = 0; i < 30; i++) await session.step(idle);
      expect(car.entity.position).toEqual(stopped.position);
      expect(car.entity.vehicleHeading).toBe(stopped.heading);
      const replica = new RemoteStateView(new World());
      for (const packet of session.frames()) {
        const message = decodeServerMessage(packet);
        if (message.type === "frame" || message.type.startsWith("sync-"))
          replica.applyMessage(message as Parameters<RemoteStateView["applyMessage"]>[0]);
      }
      expect(replica.entities.find((e) => e.id === car.entity.id)?.vehicleHeading).toBe(
        stopped.heading,
      );
      const position = { ...car.entity.position };
      await session.reload();
      const restored = required(
        [...required(session.realm.traffic).states.values()].find(
          (state) => state.entity.proceduralId === identity,
        ),
      );
      expect(restored.entity.type).toBe(`vehicle-v1:${family.model}`);
      expect(restored.entity.position).toEqual(position);
      expect(restored.entity.vehicleHeading).toBe(stopped.heading);
      expect(restored.placed).toBe(true);
      expect(session.player.player.parentId).toBe(restored.entity.id);
      session.realm.vehicles.exit(session.player);
      for (let i = 0; i < 60; i++) await session.step(idle);
      expect(restored.parked).toBe(true);
      expect(restored.entity.position).toEqual(position);
      // Per-model support height is a physical contract, independent of GPU mesh
      // loading. Retain real browser roof/input representatives separately.
      const rider = session.player.player;
      const supportHeight = family.model === "dump-truck" ? (400 / 23) * 1.25 : family.bounds[2];
      rider.position = { ...restored.entity.position };
      rider.wz = supportHeight + 3;
      rider.jumpZ = rider.wz;
      rider.jumpVZ = -40;
      session.realm.entityManager.spatialHash.update(rider);
      for (let i = 0; i < 12; i++) await session.step(idle);
      expect(rider.wz).toBe(supportHeight);
      session.player.editorEnabled = true;
      session.realm.handleMessage(session.player.clientId, session.player, {
        type: "edit-delete-entity",
        entityId: restored.entity.id,
      });
      await session.step(idle);
      await session.reload();
      expect(
        [...required(session.realm.traffic).states.values()].some(
          (state) => state.entity.proceduralId === identity,
        ),
      ).toBe(false);
    } finally {
      await session.close();
    }
  },
);
