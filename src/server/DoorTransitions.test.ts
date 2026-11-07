import { expect, it } from "vitest";
import { createTestSetup, restoreProfile } from "../../tests-support/RealmBrowser.test-helper.js";
import { PLAYER_SPEED } from "../config/constants.js";
import { CURRENT_REGIONAL_VERSION } from "../generation/GenerationDescriptor.js";
import { DenseDistrictSource } from "../generation/regional/DenseDistrictPlanner.js";
import { regionalWorld } from "../generation/regional/WorldDescriptor.js";
import { exteriorDoors } from "../interiors/BuildingDoors.js";
import { atDoorThreshold, doorwayReached } from "../interiors/DoorTraversal.js";

it("a starved authority keeps the guided walk going until its own pose reaches the doorway", async () => {
  const { server, transport, registry } = await createTestSetup();
  const generation = {
    type: "regional",
    version: CURRENT_REGIONAL_VERSION,
    seed: 2026,
    preset: "temperate-v1",
  } as const;
  const lot = new DenseDistrictSource(regionalWorld(2026), true)
    .owner(0, 0)
    ?.blocks.flatMap((b) => b.lots)
    .find((l) => l.buildingType.includes("condo-bay"));
  if (!lot) throw new Error("Missing city building");
  const door = exteriorDoors({
    type: lot.buildingType,
    position: { wx: lot.anchor.x * 16, wy: lot.anchor.y * 16 },
  })[1];
  if (!door) throw new Error("Missing second door");
  transport.connect("local", restoreProfile);
  await server.settle();
  const meta = await registry.createWorld("Door", undefined, undefined, undefined, generation);
  await server.loadWorld(meta.id, {
    x: door.outside.wx / 16,
    y: (door.outside.wy + 48) / 16,
    generation,
  });
  const session = server.getLocalSession();
  session.editorEnabled = false;
  try {
    // The client predicts its own walk; the authority only moves on its ticks.
    let seq = 0;
    const predicted = { ...session.player.position };
    const view = () => ({
      playerEntity: { position: predicted },
      serverPlayerPosition: { ...session.player.position, wz: session.player.wz ?? 0 },
    });
    const walk = () => {
      transport.clientSend("local", {
        type: "player-input",
        seq: ++seq,
        dx: 0,
        dy: -1,
        sprinting: false,
        jump: false,
      });
      predicted.wy -= PLAYER_SPEED / 60;
    };
    const enter = (requestId: number) =>
      transport.clientSend("local", {
        type: "enter-building",
        requestId,
        featureId: lot.id,
        doorId: door.id,
        walkThrough: true,
      });
    const rejected = (requestId: number) =>
      transport.messagesOfType("local", "request-error").some((m) => m.requestId === requestId);

    // Worker starved: walking inputs queue unprocessed while prediction reaches the door.
    while (!atDoorThreshold(predicted, door.outside, true)) walk();
    walk();
    expect(doorwayReached(view(), door.outside, true)).toBe(false);
    // Requesting from the prediction alone is refused: authority never trusts the lead.
    enter(1);
    await server.settle();
    expect(rejected(1)).toBe(true);

    // Ticks resume; the client keeps walking, reconciled to each acknowledged pose.
    for (let frame = 0; frame < 120 && !doorwayReached(view(), door.outside, true); frame++) {
      walk();
      server.tick(1 / 60);
      Object.assign(predicted, session.player.position);
    }
    expect(doorwayReached(view(), door.outside, true)).toBe(true);
    enter(2);
    await server.settle();
    expect(rejected(2)).toBe(false);
    expect(transport.messagesOfType("local", "door-motion")[0]).toMatchObject({
      phase: "depart",
      self: true,
    });
  } finally {
    await server.destroy();
  }
});
