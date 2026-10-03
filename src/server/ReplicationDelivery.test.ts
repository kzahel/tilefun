import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FrameMessage } from "../shared/protocol.js";
import { createReplicationRig } from "./testing/ReplicationDeliveryHarness.js";

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

// Acceptance assertions, initially run without .fails to establish the defects.
// Each must be converted to a normal passing test when recovery is implemented.
// Recovery deadline: 120 clean authoritative frames (2 simulated seconds).
describe("known unreliable-channel convergence gaps", () => {
  it.fails("recovers a lost initial baseline after traffic becomes reliable", () => {
    rig.tick();
    rig.chicken.position.wx = 100; // Subsequent delta cannot create the missing entity.
    rig.settle();
    expect(rig.state(rig.view)).toEqual(rig.state(rig.control));
  });

  it.fails("recovers a lost final position update even if the entity stops", () => {
    rig.view.applyFrame(rig.tick());
    rig.chicken.position.wx = 100;
    rig.tick();
    rig.settle();
    expect(rig.state(rig.view)).toEqual(rig.state(rig.control));
  });

  it.fails("recovers a lost exit without retaining a ghost entity", () => {
    rig.view.applyFrame(rig.tick());
    rig.transport.clientSide.send({ type: "edit-delete-entity", entityId: rig.chicken.id });
    rig.tick();
    rig.settle();
    expect(rig.state(rig.view)).toEqual(rig.state(rig.control));
  });

  it.fails("does not regress final position when two updates arrive in reverse order", () => {
    rig.view.applyFrame(rig.tick());
    rig.chicken.position.wx = 100;
    const older = rig.tick();
    rig.chicken.position.wx = 120;
    const newer = rig.tick();
    rig.view.applyFrame(newer);
    rig.view.applyFrame(older);
    rig.settle();
    expect(rig.state(rig.view)).toEqual(rig.state(rig.control));
  });

  it.fails("rejects a delayed old-realm baseline after the client transition clear", () => {
    const stale = rig.tick();
    rig.view.applyFrame(stale);
    rig.view.clear(); // Same replica reset used by GameClient on world-loaded/realm-joined.
    rig.view.applyFrame(stale);
    expect(rig.view.entities).toEqual([]);
  });
});
