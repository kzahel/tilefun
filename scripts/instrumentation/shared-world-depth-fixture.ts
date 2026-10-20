/** Export read-only presentation snapshots from normal headless authority. */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { createCharacterEntity } from "../../src/characters/CharacterCatalog.js";
import { applyPlayerModel } from "../../src/characters/PlayerModels.js";
import { PROMOTED_CHARACTERS } from "../../src/characters/PromotedCharacters.js";
import { RemoteStateView } from "../../src/client/ClientStateView.js";
import { aabbsOverlap, getEntityAABB } from "../../src/entities/collision.js";
import { Direction } from "../../src/entities/Entity.js";
import { createPlayer } from "../../src/entities/Player.js";
import type { Prop } from "../../src/entities/Prop.js";
import { FlatStrategy } from "../../src/generation/FlatStrategy.js";
import { Camera } from "../../src/rendering/Camera.js";
import { collectScene } from "../../src/rendering/collectScene.js";
import { SceneFrame } from "../../src/rendering/SceneFrame.js";
import { FLAT_SCENARIO } from "../../src/scenarios/ScenarioRecipe.js";
import { ScenarioSession } from "../../src/scenarios/ScenarioSession.js";
import { decodeServerMessage } from "../../src/shared/binaryCodec.js";
import { World } from "../../src/world/World.js";

const output = resolve(
  process.argv.find((arg) => arg.startsWith("--output="))?.slice(9) ??
    "data/3d-investigation/shared-world/fixture.json",
);
assert.ok(output.startsWith(resolve("data") + sep));
const player = createPlayer(-400, -400);
applyPlayerModel(player, "character-person-v1");
const backWall: Prop = {
  id: 900,
  type: "diagnostic-corner",
  isProp: true,
  position: { wx: 84, wy: 0 },
  collider: { offsetX: 0, offsetY: 0, width: 40, height: 4, zBase: 0, zHeight: 8 },
  sprite: {
    sheetKey: "diagnostic-back-wall",
    frameCol: 0,
    frameRow: 0,
    spriteWidth: 48,
    spriteHeight: 52,
  },
  walls: null,
};
const sideWall: Prop = {
  ...structuredClone(backWall),
  id: 901,
  position: { wx: 62, wy: 24 },
  collider: { offsetX: 0, offsetY: 0, width: 4, height: 28, zBase: 0, zHeight: 8 },
  sprite: { ...backWall.sprite, sheetKey: "diagnostic-side-wall" },
};
const session = await ScenarioSession.create({
  version: 1,
  id: "shared-world-depth",
  generation: FLAT_SCENARIO,
  player,
  props: [backWall, sideWall],
  trafficPopulation: false,
});
try {
  await session.command({
    kind: "view-range",
    range: { minCx: -1, maxCx: 1, minCy: -1, maxCy: 1 },
  });
  // Remove incidental flat-world inhabitants only in this disposable diagnostic.
  for (const entity of [...session.realm.entityManager.entities])
    if (entity.id !== session.player.player.id)
      session.realm.entityManager.remove(entity.id, false);
  const traffic = session.realm.traffic;
  assert.ok(traffic);
  traffic.canSpawn = () => false;
  const dump = traffic.place("dump-truck", 0, 0, Direction.Right);
  const pickup = traffic.place("pickup", -26, 58, Direction.Right);
  assert.ok(dump && pickup, "Real editor-placement admission must accept both vehicles");
  assert.ok(dump.entity.collider && pickup.entity.collider);
  assert.ok(
    !aabbsOverlap(
      getEntityAABB(dump.entity.position, dump.entity.collider),
      getEntityAABB(pickup.entity.position, pickup.entity.collider),
    ),
  );
  const catDef = PROMOTED_CHARACTERS.find((entry) => entry.id === "cat");
  assert.ok(catDef);
  const cat = session.realm.entityManager.spawn(
    createCharacterEntity(catDef, catDef.defaults, -92, 35),
  );
  const view = new RemoteStateView(new World(new FlatStrategy()));
  const camera = new Camera();
  camera.setViewport(256, 224);
  camera.zoom = 1 / 3;
  camera.snapTo(20, -16);
  const frame = new SceneFrame();
  const wanted = new Set([session.player.player.id, cat.id, dump.entity.id, pickup.entity.id]);
  const cases: unknown[] = [];
  const record = (id: string, name: string) => {
    for (const buffer of session.frames()) {
      const message = decodeServerMessage(buffer);
      switch (message.type) {
        case "frame":
        case "sync-chunks":
        case "sync-props":
        case "sync-session":
          view.applyMessage(message);
      }
    }
    const entities = view.serverEntities.filter((entity) => wanted.has(entity.id));
    const props = view.props.filter((prop) => prop.sprite.sheetKey.startsWith("diagnostic-"));
    assert.equal(entities.length, 4);
    assert.equal(props.length, 2);
    const replicatedPlayer = entities.find((entity) => entity.id === session.player.player.id);
    assert.ok(replicatedPlayer?.collider);
    const body = getEntityAABB(replicatedPlayer.position, replicatedPlayer.collider);
    const conflicts = entities.filter(
      (entity) =>
        entity.type.startsWith("vehicle-v1:") &&
        entity.collider &&
        aabbsOverlap(body, getEntityAABB(entity.position, entity.collider)),
    );
    assert.equal(
      conflicts.length,
      0,
      "Outside player must remain outside both solid vehicle bodies",
    );
    assert.ok(
      props.every(
        (prop) => prop.collider && !aabbsOverlap(body, getEntityAABB(prop.position, prop.collider)),
      ),
    );
    frame.presentationTime = view.simulationTime ?? 0;
    const items = collectScene(
      entities,
      props,
      view.world,
      camera,
      camera.getVisibleChunkRange(),
      1,
      { collectElevationItems: () => [] },
      [],
      false,
      undefined,
      undefined,
      frame,
    );
    const objects = items
      .filter((item) => item.kind === "sprite")
      .map((item) => {
        const source = entities.find(
          (entity) =>
            entity.sprite?.sheetKey === item.sheetKey &&
            entity.position.wx === item.wx &&
            entity.position.wy === item.wy,
        );
        const prop = props.find((entry) => entry.sprite.sheetKey === item.sheetKey);
        assert.ok(source || prop);
        return {
          key: prop
            ? prop.sprite.sheetKey.replace("diagnostic-", "")
            : source?.id === session.player.player.id
              ? "person"
              : source?.id === cat.id
                ? "cat"
                : source?.type.slice(11),
          item: structuredClone(item),
          entity: source ? structuredClone(source) : null,
          prop: prop ? structuredClone(prop) : null,
        };
      });
    assert.equal(objects.length, 6);
    cases.push({
      id,
      name,
      simulationTime: frame.presentationTime,
      playerZ: replicatedPlayer.wz ?? 0,
      objects,
    });
    frame.release();
  };
  const position = async (wx: number, wy: number) =>
    session.command({ kind: "teleport", position: { wx, wy } });
  const jump = async () => {
    for (let i = 0; i < 18; i++) await session.step({ dx: 0, dy: 0, jump: true, sprinting: false });
    assert.ok((session.player.player.wz ?? 0) > 20, "Normal held jump must raise the player");
  };
  await position(-26, 31);
  record("between-vehicles", "Between two parked vehicles");
  await position(-10, -32);
  record("truck-ground", "Behind the actual dump truck");
  await jump();
  record("truck-jump", "Jumping behind the actual dump truck");
  await position(69, 10);
  record("wall-corner", "Outside person inside the wall corner");
  await jump();
  record("wall-jump", "Jumping above the wall corner");
  await position(69, 35);
  record("wall-front", "Outside person in front of the wall");
  await mkdir(dirname(output), { recursive: true });
  await writeFile(
    output,
    `${JSON.stringify(
      {
        schema: "tilefun-shared-world-fixture-v1",
        source: "ScenarioSession -> binary -> RemoteStateView -> collectScene",
        worker: false,
        viewport: { width: 256, height: 224, centerX: 20, centerY: -16 },
        cases,
      },
      null,
      2,
    )}\n`,
  );
  console.log(`Six production-authority/collector snapshots exported: ${output}`);
} finally {
  await session.close();
}
