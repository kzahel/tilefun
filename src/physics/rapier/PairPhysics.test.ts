import { beforeAll, expect, it } from "vitest";
import { poseDistance } from "./FullWorldPredictor.js";
import { PairAuthority } from "./PairAuthority.js";
import { PairHarness } from "./PairHarness.js";
import { PhysicsLink } from "./PhysicsLink.js";
import { PAIR_SCENARIOS, pairInput, setupPair } from "./PhysicsScenarios.js";
import { initRapier, RapierWorld } from "./RapierWorld.js";

beforeAll(initRapier);
it.each(["opposed", "player-head-on", "player-glance"] as const)(
  "restores and exactly replays both motors and contacts in %s",
  (scene) => {
    const authority = new RapierWorld(2, 0),
      replay = new RapierWorld(2, 0);
    try {
      setupPair(authority, scene);
      for (let tick = 1; tick <= 55; tick++)
        authority.step(pairInput(scene, 0, tick), pairInput(scene, 1, tick));
      replay.restoreFull(authority.snapshot());
      for (let tick = 56; tick < 160; tick++) {
        const inputs = [pairInput(scene, 0, tick), pairInput(scene, 1, tick)] as const;
        authority.step(...inputs);
        replay.step(...inputs);
        expect(poseDistance(authority.poses(), replay.poses())).toBeLessThan(0.00001);
        expect([...replay.poses()]).toEqual([...authority.poses()]);
      }
    } finally {
      authority.dispose();
      replay.dispose();
    }
  },
);
it.each(PAIR_SCENARIOS)(
  "runs $name through two real Realm sessions and converges under jitter",
  async ({ id }) => {
    const authority = await PairAuthority.create(id);
    const harness = new PairHarness(
      { scene: id, rtt: 200, jitter: 20, seed: 713 },
      authority,
      authority.frame(),
    );
    try {
      for (let tick = 0; tick < 300; tick++) await harness.step();
      if (["push", "opposed", "push-player", "reversal"].includes(id)) {
        const cube = authority.session.realm.entityManager.entities.find(
          (actor) => Math.abs((actor.collider?.physicalHeight ?? 0) - 12.8) < 0.001,
        );
        expect(cube?.collider?.width).toBeCloseTo(12.8);
        const index = [...harness.latest.poses].findIndex(
          (value, i) => i % 14 === 0 && value === 2,
        );
        expect((cube?.wz ?? 0) / 16).toBeCloseTo((harness.latest.poses[index + 2] ?? 0) - 0.4, 5);
      }
      expect(harness.latest.lateInputs).toBe(0);
      expect(harness.queued).toBeLessThan(40);
      expect(harness.latest.snapshot.ack[0]).toBeGreaterThan(290);
      expect(harness.latest.snapshot.ack[1]).toBeGreaterThan(290);
      for (const seat of [0, 1] as const) {
        const predictor = harness.clients[seat];
        expect(predictor.diagnostics.recoveries).toBe(0);
        expect(predictor.diagnostics.correction).toBeLessThan(0.001);
        expect(predictor.diagnostics.comparedTick).toBeGreaterThan(285);
        const replica = harness.replicas[seat];
        const frame = harness.received[seat];
        expect(replica.lastProcessedInputSeq).toBe(frame?.snapshot.ack[seat]);
        expect(replica.serverPlayerEntity.position.wx / 16).toBeCloseTo(
          frame?.snapshot.state.motors[seat]?.x ?? 0,
          2,
        );
      }
    } finally {
      await harness.close();
    }
  },
  15000,
);
it("seeded links preserve order and enforce memory bounds", () => {
  const a = new PhysicsLink<number>(50, 20, 9),
    b = new PhysicsLink<number>(50, 20, 9);
  for (let i = 0; i < 20; i++) {
    a.push(i * 5, i, 8);
    b.push(i * 5, i, 8);
  }
  const delivered: number[] = [];
  for (let time = 0; time < 250; time++) {
    const values = a.drain(time);
    expect(values).toEqual(b.drain(time));
    delivered.push(...values);
  }
  expect(delivered).toEqual(Array.from({ length: 20 }, (_, i) => i));
  expect(() => a.push(0, 1, 17 * 1024 * 1024)).toThrow("bound");
  a.clear();
  expect(a.pending).toBe(0);
});

it("repeats a scripted network trace with the same seed and bounds a missing-history recovery", async () => {
  const traces: number[][][] = [];
  for (let run = 0; run < 2; run++) {
    const authority = await PairAuthority.create("opposed");
    const harness = new PairHarness(
      { scene: "opposed", rtt: 200, jitter: 20, seed: 713 },
      authority,
      authority.frame(),
    );
    const trace: number[][] = [];
    try {
      for (let tick = 0; tick < 140; tick++) {
        await harness.step();
        trace.push([...harness.latest.poses, harness.clients[1].diagnostics.comparedTick]);
      }
      traces.push(trace);
      expect(harness.clients[1].diagnostics.maxCorrection).toBeGreaterThan(0.01);
      expect(harness.clients[1].diagnostics.maxCorrection).toBeLessThan(0.3);
      const initialTick = harness.latest.snapshot.state.motors[0]?.tick ?? 0;
      const predictor = harness.clients[0];
      for (let i = 0; i < 40; i++)
        predictor.advance(predictor.tick + 1, { x: 0, z: 0, jump: false });
      // A fresh authority frame beyond the last delivery, but too far behind live.
      const next = await authority.step([]);
      predictor.receive(next.snapshot);
      expect(predictor.diagnostics.recoveries).toBe(1);
      expect(predictor.tick).toBe(initialTick + 1);
      predictor.receive(harness.latest.snapshot);
      expect(predictor.tick).toBe(initialTick + 1);
    } finally {
      await harness.close();
    }
  }
  expect(traces[0]).toEqual(traces[1]);
});

it("retains an odd-tick entity change until the next delivered replication frame", async () => {
  const authority = await PairAuthority.create("push");
  const harness = new PairHarness(
    { scene: "push", rtt: 200, jitter: 20, seed: 713 },
    authority,
    authority.frame(),
  );
  try {
    for (let tick = 0; tick < 20; tick++) await harness.step();
    const cube = authority.session.realm.entityManager.entities.find(
      (actor) => Math.abs((actor.collider?.physicalHeight ?? 0) - 12.8) < 0.001,
    );
    if (!cube) throw Error("Missing dynamic cube");
    cube.noShadow = true;
    authority.session.realm.records?.changed(cube);
    await harness.step();
    expect(harness.latest.frames).toEqual([[], []]);
    for (let tick = 0; tick < 20; tick++) await harness.step();
    for (const replica of harness.replicas)
      expect(replica.entities.find((actor) => actor.id === cube.id)?.noShadow).toBe(true);
  } finally {
    await harness.close();
  }
});

it("measures the live-pose start/stop jump and compares smooth and buffered presentation without changing physics", async () => {
  const authority = await PairAuthority.create("start-stop");
  const harness = new PairHarness(
    { scene: "start-stop", rtt: 200, jitter: 20, seed: 713 },
    authority,
    authority.frame(),
  );
  const smooth = harness.presentation[1];
  smooth.remoteMode = "predicted";
  const { PairPresentation } = await import("./PairPresentation.js");
  const buffered = new PairPresentation(1, harness.lead[1]);
  buffered.acceptAuthority(0, harness.latest.poses);
  let lastReconcile = 0,
    peak = 0,
    missedByPastMetric = false;
  try {
    for (let tick = 0; tick < 240; tick++) {
      buffered.advance(1 / 60);
      const before = harness.clients[1].world.poses();
      await harness.step();
      const client = harness.clients[1],
        received = harness.received[1];
      if (received && lastReconcile !== client.diagnostics.reconciles) {
        // Buffered presentation ignores remote raw corrections; local/body offsets
        // are independently covered by the pure presentation tests.
        buffered.acceptAuthority(received.snapshot.state.motors[0]?.tick ?? 0, received.poses);
        lastReconcile = client.diagnostics.reconciles;
      }
      const raw = client.world.poses();
      smooth.sample(raw, harness.tick);
      buffered.sample(raw, harness.tick);
      expect(client.world.poses()).toEqual(raw);
      peak = Math.max(peak, client.diagnostics.currentCorrection);
      if (
        client.diagnostics.currentCorrection > 1 &&
        client.diagnostics.correction < client.diagnostics.currentCorrection / 5
      )
        missedByPastMetric = true;
      expect(before.length).toBe(raw.length);
    }
    expect(peak).toBeGreaterThan(1);
    expect(missedByPastMetric).toBe(true);
    expect(smooth.diagnostics.maxRemoteStep).toBeLessThan(0.25);
    expect(buffered.diagnostics.maxRemoteStep).toBeLessThan(0.077);
    expect(buffered.diagnostics.remoteSource).toBe("buffered");
    expect(buffered.diagnostics.remoteOffset).toBe(0);
    expect(harness.clients[1].diagnostics.recoveries).toBe(0);
  } finally {
    buffered.clear();
    await harness.close();
  }
});

it.each([0, 1] as const)(
  "keeps quick reversals continuous when controlling seat %s near the cube",
  async (controlled) => {
    const authority = await PairAuthority.create("reversal");
    const harness = new PairHarness(
      { scene: "reversal", rtt: 200, jitter: 20, seed: 713 },
      authority,
      authority.frame(),
    );
    harness.script = false;
    harness.controlled = controlled;
    let maxOwnStep = 0,
      previousOwn: ReturnType<(typeof harness.clients)[0]["world"]["motor"]> | undefined;
    const sources = new Set<string>();
    try {
      for (let tick = 0; tick < 300; tick++) {
        harness.desired = pairInput("reversal", 0, harness.tick + harness.lead[controlled] + 1);
        await harness.step();
        for (const seat of [0, 1] as const) harness.presentedPoses(seat);
        const current = harness.clients[controlled].world.motorFor(controlled);
        if (previousOwn)
          maxOwnStep = Math.max(
            maxOwnStep,
            Math.hypot(
              current.x - previousOwn.x,
              current.y - previousOwn.y,
              current.z - previousOwn.z,
            ),
          );
        previousOwn = current;
        const remote = harness.presentation[controlled === 0 ? 1 : 0];
        sources.add(remote.diagnostics.remoteSource);
        expect(remote.diagnostics.maxCorrectionReleaseSpeed).toBeLessThanOrEqual(4.50001);
        expect(remote.diagnostics.maxRemoteStep).toBeLessThan(0.17);
      }
      expect(sources).toEqual(new Set(["buffered"]));
      expect(maxOwnStep).toBeLessThan(0.08);
      expect(harness.latest.lateInputs).toBe(0);
      for (const client of harness.clients) expect(client.diagnostics.recoveries).toBe(0);
    } finally {
      await harness.close();
    }
  },
);

it("shows the host touching the cube before its first visible push in the idle guest view", async () => {
  const authority = await PairAuthority.create("push");
  const harness = new PairHarness(
    { scene: "push", rtt: 200, jitter: 20, seed: 713 },
    authority,
    authority.frame(),
  );
  let previousCubeX = -12.5,
    firstPushGap: number | undefined;
  try {
    for (let tick = 0; tick < 180; tick++) {
      await harness.step();
      harness.presentedPoses(0);
      const displayed = harness.presentedPoses(1);
      const cube = displayed.findIndex((v, i) => i % 14 === 0 && v === 2);
      const host = displayed.findIndex((v, i) => i % 14 === 0 && v === 0);
      const cubeX = displayed[cube + 1] ?? 0;
      if (cubeX - previousCubeX > 0.005 && firstPushGap === undefined)
        firstPushGap = cubeX - 0.4 - ((displayed[host + 1] ?? 0) + 0.28);
      previousCubeX = cubeX;
      const p = harness.presentation[1].diagnostics;
      expect(p.cubeSource).toBe(p.remoteSource);
      expect(p.cubeDisplayTick).toBe(p.remoteDisplayTick);
      if (tick >= 40 && tick < 100)
        expect(harness.presentation[0].diagnostics.ownSource).toBe("predicted");
      if (tick > 160) expect(harness.presentation[0].diagnostics.ownSource).toBe("buffered");
    }
    expect(firstPushGap).toBeDefined();
    // 30 Hz snapshot interpolation and the character controller skin permit a
    // sub-step gap; the previous mixed timeline produced roughly 0.9–1.0 m.
    expect(firstPushGap).toBeLessThan(0.12);
  } finally {
    await harness.close();
  }
});
