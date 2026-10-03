import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FrameMessage } from "../shared/protocol.js";
import { createReplicationRig } from "./testing/ReplicationDeliveryHarness.js";
import { ReplicationDeliveryQueue } from "./testing/ReplicationDeliveryQueue.js";

let rig: ReturnType<typeof createReplicationRig>;
beforeEach(() => {
  rig = createReplicationRig();
});
afterEach(() => rig.server.destroy());

describe("replication delivery controls", () => {
  it("converges through the codec with ordered delivery, edits and deletion", () => {
    rig.view.applyFrame(rig.tick());
    rig.chicken.position.wx = 100;
    rig.view.applyFrame(rig.tick());
    expect(rig.state(rig.view)).toEqual(rig.state(rig.control));
    rig.transport.clientSide.send({ type: "edit-delete-entity", entityId: rig.chicken.id });
    rig.settle();
    expect(rig.state(rig.view)).toEqual(rig.state(rig.control));
  });

  it("converges after bounded reliable delay without dropping dependent frames", () => {
    const queue: FrameMessage[] = [];
    for (let i = 0; i < 60; i++) {
      rig.chicken.position.wx = 50 + i;
      queue.push(rig.tick());
      if (queue.length > 6) {
        const ready = queue.shift();
        if (ready) rig.view.applyFrame(ready);
      }
    }
    for (const frame of queue) rig.view.applyFrame(frame);
    expect(rig.state(rig.view)).toEqual(rig.state(rig.control));
  });

  it("replicates mount and dismount parenting through the ordinary wire path", () => {
    const mount = rig.server.worldAPI.entities.spawn("cow", 70, 50);
    const player = rig.server.worldAPI.player.get();
    if (!mount || !player) throw new Error("Missing mount fixture");
    rig.view.applyFrame(rig.tick());
    player.mount(mount);
    rig.view.applyFrame(rig.tick());
    expect(rig.server.getLocalSession().player.parentId).toBe(mount.id);
    expect(rig.state(rig.view)).toEqual(rig.state(rig.control));
    player.dismount();
    rig.view.applyFrame(rig.tick());
    expect(rig.state(rig.view)).toEqual(rig.state(rig.control));
  });

  it("fresh reconnect clears baselines and repairs a missing entity", () => {
    rig.tick(); // Lose initial baseline.
    rig.settle();
    expect(rig.view.entities.some((entity) => entity.id === rig.chicken.id)).toBe(false);
    rig.transport.triggerDisconnect();
    rig.view.clear();
    rig.transport.triggerConnect();
    rig.settle();
    expect(rig.state(rig.view)).toEqual(rig.state(rig.control));
  });
});

// Faults enter before channel delivery. Sync must preserve every dependent message
// and its order, including world resets; arbitrary post-SCTP drops are not supported.
describe("reliable replication delivery regressions", () => {
  function delivery() {
    return new ReplicationDeliveryQueue((message) => {
      if (message.type === "frame") rig.view.applyFrame(message);
      else if (message.type === "world-loaded") rig.view.clear();
    });
  }

  it("delays an initial baseline and its dependent updates together", () => {
    const queue = delivery();
    queue.enqueue(rig.tick(), 0, 0, true);
    rig.chicken.position.wx = 100;
    queue.enqueue(rig.tick(), 1);
    queue.drain(1);
    expect(rig.view.entities).toEqual([]);
    queue.drain(31);
    expect(rig.state(rig.view)).toEqual(rig.state(rig.control));
    expect(queue.dropped).toBe(0);
    expect(queue.delayedByLoss).toBe(1);
  });

  it("delivers a delayed final position even after the entity stops", () => {
    rig.view.applyFrame(rig.tick());
    const queue = delivery();
    rig.chicken.position.wx = 100;
    queue.enqueue(rig.tick(), 0, 0, true);
    queue.enqueue(rig.tick(), 1);
    queue.drain(31);
    rig.settle();
    expect(rig.state(rig.view)).toEqual(rig.state(rig.control));
  });

  it("delivers a delayed exit without retaining a ghost", () => {
    rig.view.applyFrame(rig.tick());
    const queue = delivery();
    rig.transport.clientSide.send({ type: "edit-delete-entity", entityId: rig.chicken.id });
    queue.enqueue(rig.tick(), 0, 0, true);
    queue.enqueue(rig.tick(), 1);
    queue.drain(31);
    rig.settle();
    expect(rig.state(rig.view)).toEqual(rig.state(rig.control));
  });

  it("prevents a newer update overtaking a delayed older update", () => {
    rig.view.applyFrame(rig.tick());
    const queue = delivery();
    rig.chicken.position.wx = 100;
    queue.enqueue(rig.tick(), 0, 12);
    rig.chicken.position.wx = 120;
    queue.enqueue(rig.tick(), 1);
    queue.drain(1);
    queue.drain(12);
    rig.settle();
    expect(rig.state(rig.view)).toEqual(rig.state(rig.control));
  });

  it("keeps a world reset behind delayed old-world frames on the same stream", () => {
    const queue = delivery();
    queue.enqueue(rig.tick(), 0, 12);
    queue.enqueue({ type: "world-loaded", cameraX: 0, cameraY: 0, cameraZoom: 1 }, 1);
    queue.drain(1);
    queue.drain(12);
    expect(rig.view.entities).toEqual([]);
  });
});
