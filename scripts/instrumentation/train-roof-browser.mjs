// Real Worker/keyboard reproduction. Hooks observe production behavior only.
import { execFileSync } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { chromium } from "playwright-core";
import { createServer } from "vite";

const option = (name, fallback) =>
  process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const renderer = option("renderer", "canvas");
const delay = Number(option("delay", "0"));
const serverHz = option("server-hz", "60");
const idleJump = process.argv.includes("--idle-jump");
const jumpMomentum = process.argv.includes("--jump-momentum") || idleJump;
if (jumpMomentum && serverHz === "alternate")
  throw Error("Use a fixed server rate for jump flights");
const renderHz = option("render-hz", "native");
if (
  process.argv.includes("--reload-pacing") &&
  (renderHz !== "native" || serverHz === "alternate" || delay || jumpMomentum)
)
  throw Error("Reload pacing requires native render, a fixed rate, no emulation and no jumping");
if (!["30", "60", "alternate"].includes(serverHz) || !["native", "120"].includes(renderHz))
  throw Error("Use --server-hz=30|60|alternate and --render-hz=native|120");
if (!["canvas", "gpu"].includes(renderer) || !Number.isFinite(delay) || delay < 0 || delay > 200)
  throw Error("Use --renderer=canvas|gpu and --delay=0..200 (ms each way)");
const temp = await mkdtemp(path.join(os.tmpdir(), "tilefun-train-prediction-"));
for (const key of [
  "WORKSHOP_AUTH_DIR",
  "WORKSHOP_DATA_DIR",
  "ART_NOTES_DIR",
  "INTERIOR_REVIEW_DIR",
])
  process.env[key] = path.join(temp, key);
const server = await createServer({
  configFile: false,
  base: "/tilefun/",
  plugins: [react()],
  server: { host: "127.0.0.1", port: 0, hmr: false },
  logLevel: "error",
});
let browser;
// biome-ignore lint/suspicious/noConfusingLabels: each diagnostic exits through the shared cleanup.
probe: try {
  await server.listen();
  browser = await chromium.launch({
    channel: "chromium",
    headless: !process.argv.includes("--headed"),
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const origin = `http://127.0.0.1:${server.httpServer.address().port}/tilefun/`;
  await page.goto(origin);
  const generation = await page.evaluate(async () => {
    const { createDescriptor } = await import("/tilefun/src/generation/GenerationDescriptor.ts");
    return createDescriptor("regional", 2026);
  });
  await page.goto(
    `${origin}?nogamepad&renderer=${renderer}&generation=${encodeURIComponent(JSON.stringify(generation))}`,
  );
  await page.getByPlaceholder("World name...").fill("Train prediction diagnostic");
  await page.getByRole("button", { name: "New World", exact: true }).click();
  await page.waitForFunction(() => {
    const game = document.querySelector("#game")?.__game;
    return game?.stateView.entities.some((e) => e.type === "train-curve-proof-v1");
  });
  await page.waitForFunction(() => {
    const game = document.querySelector("#game")?.__game;
    const p = game?.stateView.playerEntity.position;
    return (
      game?.initDone &&
      p &&
      game.renderer.isTerrainReady(
        game.stateView.world.chunks.get(Math.floor(p.wx / 256), Math.floor(p.wy / 256)),
      )
    );
  });
  const actualRenderer = await page.getAttribute("#game", "data-renderer");
  if (actualRenderer !== renderer) throw Error(`Requested ${renderer}, got ${actualRenderer}`);
  // World creation and replica application are asynchronous; don't send boarding
  // keys against an earlier spawn whose terrain happens to already be ready.
  await page.waitForFunction(() => {
    const g = document.querySelector("#game").__game;
    const p = g.remoteView.serverPlayerEntity;
    const car = g.remoteView.serverEntities.find((e) => e.type === "train-curve-proof-v1");
    return car && Math.hypot(p.position.wx - car.position.wx, p.position.wy - car.position.wy) < 80;
  });
  if (await page.evaluate(() => document.querySelector("#game").__game.stateView.editorEnabled))
    await page.keyboard.press("Tab");
  await page.waitForFunction(() => {
    const g = document.querySelector("#game").__game;
    return !g.remoteView.editorEnabled && g.remoteView._predictor?.player;
  });
  await page.keyboard.down("ArrowDown");
  // Approach the actual body before jumping. A timed approach from spawn can
  // miss the roof when startup work delays keyboard command delivery.
  await page.waitForFunction(() => {
    const g = document.querySelector("#game").__game;
    const car = g.remoteView.serverEntities.find((e) => e.type === "train-curve-proof-v1");
    return car && g.remoteView.serverPlayerEntity.position.wy >= car.position.wy - 14;
  }, undefined, { timeout: 2000 });
  await page.keyboard.down("Space");
  await page.waitForFunction(() => {
    const p = document.querySelector("#game").__game.remoteView.serverPlayerEntity;
    return p.jumpVZ !== undefined;
  }, undefined, { timeout: 1000 });
  await page.waitForFunction(() => {
    const g = document.querySelector("#game").__game;
    const car = g.remoteView.serverEntities.find((e) => e.type === "train-curve-proof-v1");
    return car && g.remoteView.serverPlayerEntity.position.wy >= car.position.wy + 3;
  }, undefined, { timeout: 1500 });
  await page.keyboard.up("ArrowDown");
  await page
    .waitForFunction(() => {
      const p = document.querySelector("#game").__game.remoteView.serverPlayerEntity;
      return p.wz === 44 && p.jumpVZ === undefined;
    })
    .catch(async (error) => {
      console.log(
        JSON.stringify(
          await page.evaluate(() => {
            const g = document.querySelector("#game").__game;
            return {
              player: g.remoteView.serverPlayerEntity,
              trains: g.remoteView.serverEntities.filter((e) => e.type.startsWith("train")),
              errors: [],
            };
          }),
        ),
      );
      throw error;
    });
  await page.keyboard.up("Space");
  const setRate = async (hz) => {
    const output = await page.evaluate(async (hz) => {
      const game = document.querySelector("#game").__game;
      const result = await game.gcSendRequest({
        type: "rcon",
        requestId: game.nextRequestId++,
        command: `sv_tickrate ${hz}`,
      });
      return result.output;
    }, hz);
    console.log(
      JSON.stringify({
        requestedHz: hz,
        output,
        advertisedHz: await page.evaluate(
          () => document.querySelector("#game").__game.remoteView.tickRate,
        ),
      }),
    );
    await page.waitForFunction(
      (hz) => Math.abs(document.querySelector("#game").__game.remoteView.tickRate - hz) < 0.001,
      hz,
    );
    return output;
  };
  if (process.argv.includes("--reload-pacing")) {
    if (serverHz === "30") await setRate(30);
    const { runTrainRefreshProbe } = await import("./train-refresh-probe.mjs");
    const capture = await runTrainRefreshProbe(page, origin, renderer, serverHz);
    const output = option("output", `/tmp/train-refresh-${renderer}-${serverHz}.json`);
    await writeFile(
      output,
      `${JSON.stringify({ renderer, serverHz, errors, ...capture }, null, 2)}\n`,
    );
    console.log(JSON.stringify({ output, errors, ...capture.summaries }, null, 2));
    if (process.argv.includes("--assert-presentation")) {
      for (const summary of Object.values(capture.summaries))
        if (
          summary.steadySteps < 60 ||
          ![
            summary.maxStepError,
            summary.maxPlayerStepError,
            summary.roofOffsetRange,
            summary.maxCameraStepError,
          ].every(Number.isFinite) ||
          summary.maxStepError > 0.1 ||
          summary.maxPlayerStepError > 0.1 ||
          summary.roofOffsetRange > 0.02 ||
          summary.maxCameraStepError > 0.1 ||
          summary.advertisedRates.some((hz) => Math.abs(hz - Number(serverHz)) > 0.001)
        )
          throw Error("Refresh presentation continuity failed");
      if (errors.length) throw Error("Browser errors");
    }
    break probe;
  }
  const rateCommands = [
    { hz: serverHz === "30" ? 30 : 60, output: await setRate(serverHz === "30" ? 30 : 60) },
  ];
  await page.evaluate(
    async ({ delay, renderHz }) => {
      const { roofSupport } = await import("/tilefun/src/traffic/RoofSupport.ts");
      const game = document.querySelector("#game").__game;
      if (delay)
        game.netEmulatedTransport.setConfig({
          enabled: true,
          txLatencyMs: delay,
          rxLatencyMs: delay,
        });
      const predictor = game.remoteView._predictor;
      if (!predictor) throw Error("Missing production predictor");
      const samples = [],
        reconciliations = [],
        inputs = [];
      const reconcile = predictor.reconcile;
      predictor.reconcile = function (...args) {
        const before = { ...this.player.position };
        reconcile.apply(this, args);
        const car = game.remoteView.serverEntities.find((e) => e.type === "train-curve-proof-v1");
        const d = this.lastReconcileDiagnostics;
        reconciliations.push({
          t: performance.now(),
          ...d,
          shiftX: this.player.position.wx - before.wx,
          shiftY: this.player.position.wy - before.wy,
          trainX: car?.position.wx,
          trainY: car?.position.wy,
          trainSpeed: Math.hypot(car?.velocity?.vx ?? 0, car?.velocity?.vy ?? 0),
          trainHeading: car?.sprite?.frameRow,
          serverOffsetX: args[0].position.wx - (car?.position.wx ?? 0),
        });
      };
      const send = game.transport.send;
      game.transport.send = function (message) {
        if (message.type === "player-input")
          inputs.push({
            t: performance.now(),
            seq: message.seq,
            dtMs: message.dtMs,
            dx: message.dx,
            dy: message.dy,
          });
        return send.call(this, message);
      };
      const render = game.loop.callbacks.render;
      const restoreActual = game.camera.restoreActual;
      let renderedCamera;
      let renderedPoses;
      let renderAlpha;
      game.camera.restoreActual = function () {
        renderedCamera = { x: this.x, y: this.y, prevX: this.prevX, prevY: this.prevY };
        const player = game.remoteView.presentedPlayerEntity;
        const car = game.remoteView.entities.find((e) => e.type === "train-curve-proof-v1");
        const lerp = (a, b) => a + (b - a) * renderAlpha;
        if (car)
          renderedPoses = {
            px: lerp(player.prevPosition?.wx ?? player.position.wx, player.position.wx),
            py: lerp(player.prevPosition?.wy ?? player.position.wy, player.position.wy),
            tx: lerp(car.prevPosition?.wx ?? car.position.wx, car.position.wx),
            ty: lerp(car.prevPosition?.wy ?? car.position.wy, car.position.wy),
            wz: player.wz,
          };
        return restoreActual.call(this);
      };
      game.loop.callbacks.render = (alpha, now) => {
        renderAlpha = alpha;
        renderedCamera = undefined;
        renderedPoses = undefined;
        render(alpha, now);
        const car = game.remoteView.serverEntities.find((e) => e.type === "train-curve-proof-v1");
        if (!car) return;
        if (!renderedCamera) throw Error("Missing render-time camera pose");
        if (!renderedPoses) throw Error("Missing borrowed render-time entity poses");
        const { px, py, tx, ty } = renderedPoses;
        const server = game.remoteView.serverPlayerEntity;
        samples.push({
          t: now * 1000,
          capturedAtMs: performance.now(),
          alpha,
          serverTick: game.remoteView.serverTick,
          ack: game.remoteView.lastProcessedInputSeq,
          simulationTime: game.remoteView.simulationTime,
          tickRate: game.remoteView.tickRate,
          playerX: px,
          playerY: py,
          trainX: tx,
          trainY: ty,
          cameraX: renderedCamera?.x,
          cameraY: renderedCamera?.y,
          cameraPrevX: renderedCamera?.prevX,
          cameraActualX: game.camera.x,
          playerScreenX: (px - (renderedCamera?.x ?? NaN)) * game.camera.scale,
          playerVx: predictor.player.velocity?.vx,
          serverVx: server.velocity?.vx,
          serverAirborne: server.jumpVZ !== undefined,
          predictedAirborne: predictor.player.jumpVZ !== undefined,
          serverMomentumX: server.airMomentumX,
          serverMomentumY: server.airMomentumY,
          serverRoofId: roofSupport(server, game.remoteView.serverEntities)?.id,
          offsetX: px - tx,
          offsetY: py - ty,
          serverOffsetX: server.position.wx - car.position.wx,
          z: renderedPoses.wz,
          serverZ: server.wz,
          heading: car.sprite?.frameRow,
          speed: Math.hypot(car.velocity?.vx ?? 0, car.velocity?.vy ?? 0),
          pending: game.remoteView.pendingMessageCount,
        });
      };
      let timer;
      if (renderHz === "120") {
        // Exercise the real update/render callbacks through the production
        // external clock. Actual wall timestamps are measured, not fabricated.
        game.loop.stop();
        let deadline = performance.now();
        const tick = () => {
          game.loop.externalTick(performance.now());
          deadline += 1000 / 120;
          timer = setTimeout(tick, Math.max(0, deadline - performance.now()));
        };
        tick();
      }
      window.finishTrainProbe = () => {
        clearTimeout(timer);
        predictor.reconcile = reconcile;
        game.transport.send = send;
        game.loop.callbacks.render = render;
        game.camera.restoreActual = restoreActual;
        return { samples, reconciliations, inputs };
      };
    },
    { delay, renderHz },
  );
  if (jumpMomentum) {
    await page.waitForFunction(
      () => {
        const g = document.querySelector("#game").__game;
        const car = g.remoteView.serverEntities.find((e) => e.type === "train-curve-proof-v1");
        return car?.velocity?.vx > 191.9 && g.remoteView.serverPlayerEntity.wz === 44;
      },
      undefined,
      { timeout: 15000 },
    );
    if (idleJump) {
      for (let flight = 0; flight < 2; flight++) {
        await page.keyboard.down("Space");
        await page.waitForTimeout(650);
        await page.keyboard.up("Space");
        await page.waitForTimeout(700);
      }
      await page.waitForTimeout(1000);
    } else {
      await page.keyboard.down("ArrowRight");
      await page.waitForTimeout(700);
      await page.keyboard.down("Space");
      await page.waitForTimeout(650);
      await page.keyboard.up("Space");
      await page.keyboard.up("ArrowRight");
      await page.waitForTimeout(200);
      await page.keyboard.down("Space");
      await page.waitForTimeout(100);
      await page.keyboard.down("ArrowRight");
      await page.waitForTimeout(120);
      await page.keyboard.up("ArrowRight");
      await page.keyboard.down("ArrowLeft");
      await page.waitForTimeout(120);
      await page.keyboard.up("ArrowLeft");
      await page.waitForTimeout(400);
      await page.keyboard.up("Space");
      await page.waitForTimeout(4000);
    }
  } else if (serverHz === "alternate") {
    await page.waitForTimeout(4000);
    rateCommands.push({ hz: 30, output: await setRate(30) });
    await page.waitForTimeout(8000);
    rateCommands.push({ hz: 60, output: await setRate(60) });
    await page.waitForTimeout(8000);
  } else await page.waitForTimeout(20000);
  const raw = await page.evaluate(() => window.finishTrainProbe());
  const cruise = raw.samples.filter(
    (sample) => sample.speed > 191.9 && sample.heading === 0 && sample.serverZ === 44,
  );
  const stopped = raw.samples.filter(
    (sample) => sample.speed === 0 && sample.heading === 0 && sample.serverZ === 44,
  );
  const cruiseReconciles = raw.reconciliations.filter(
    (sample) => sample.trainSpeed > 191.9 && sample.trainHeading === 0,
  );
  const stats = (values) => {
    const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
    return {
      count: sorted.length,
      min: sorted[0],
      max: sorted.at(-1),
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
    };
  };
  const clockResiduals = [];
  let cruiseSince;
  const cruiseSteps = raw.samples.slice(1).flatMap((b, i) => {
    const a = raw.samples[i];
    if (
      a.speed < 191.9 ||
      b.speed < 191.9 ||
      a.heading !== 0 ||
      b.heading !== 0 ||
      a.serverZ !== 44 ||
      b.serverZ !== 44
    ) {
      cruiseSince = undefined;
      return [];
    }
    cruiseSince ??= a.t;
    const dt = (b.t - a.t) / 1000;
    return [
      {
        t: b.t,
        dt,
        cameraStep: b.cameraX - a.cameraX,
        cameraVelocity: (b.cameraX - a.cameraX) / dt,
        playerStep: b.playerX - a.playerX,
        screenStep: b.playerScreenX - a.playerScreenX,
        alphaBefore: a.alpha,
        alphaAfter: b.alpha,
        tickDelta: b.serverTick - a.serverTick,
        steady: b.t - cruiseSince >= 1000,
        worldStepError: b.playerX - a.playerX - 192 * dt,
        cameraStepError: b.cameraX - a.cameraX - 192 * dt,
      },
    ];
  });
  const clockGroups = new Map();
  const cruiseSkips = cruiseSteps.filter((s) => s.screenStep > 3);
  const rateCadence = new Map();
  // Exclude transition edges: advertised metadata and consumed snapshots cross
  // the independently scheduled client boundary at different instants.
  const rateSegments = [];
  for (const sample of raw.samples) {
    const hz = Math.round(sample.tickRate);
    let segment = rateSegments.at(-1);
    if (!segment || segment.hz !== hz) {
      segment = { hz, samples: [] };
      rateSegments.push(segment);
    }
    segment.samples.push(sample);
  }
  const steadyRateSamples = rateSegments.flatMap((segment) =>
    segment.samples.filter(
      (s) => s.t >= segment.samples[0].t + 500 && s.t <= segment.samples.at(-1).t - 500,
    ),
  );
  for (let i = 1; i < steadyRateSamples.length; i++) {
    const a = steadyRateSamples[i - 1],
      b = steadyRateSamples[i];
    const hz = Math.round(b.tickRate);
    if (Math.round(a.tickRate) !== hz || b.t - a.t > 100) continue;
    const cadence = rateCadence.get(hz) ?? { elapsedMs: 0, ticks: 0 };
    cadence.elapsedMs += b.t - a.t;
    cadence.ticks += b.serverTick - a.serverTick;
    rateCadence.set(hz, cadence);
  }
  const inputDurations = new Map(raw.inputs.map((s) => [s.seq, s.dtMs / 1000]));
  for (let i = 1; i < raw.reconciliations.length; i++) {
    const a = raw.reconciliations[i - 1],
      b = raw.reconciliations[i];
    if (
      a.trainSpeed < 191.9 ||
      b.trainSpeed < 191.9 ||
      a.trainHeading !== 0 ||
      b.trainHeading !== 0
    )
      continue;
    const acknowledged = b.ackSeq - a.ackSeq;
    const trainTravel = b.trainX - a.trainX;
    let acknowledgedSeconds = 0;
    let complete = true;
    for (let seq = a.ackSeq + 1; seq <= b.ackSeq; seq++) {
      const dt = inputDurations.get(seq);
      if (dt === undefined) {
        complete = false;
        break;
      }
      acknowledgedSeconds += dt;
    }
    if (!complete) continue;
    const expectedShift = trainTravel - 192 * acknowledgedSeconds;
    clockResiduals.push(Math.abs(b.shiftX - expectedShift));
    const key = `${b.serverTick - a.serverTick} server ticks / ${acknowledged} acknowledged commands`;
    const group = clockGroups.get(key) ?? [];
    group.push(b.shiftX);
    clockGroups.set(key, group);
  }
  const jumpFlights = [];
  for (let i = 1; i < raw.samples.length; i++) {
    if (!raw.samples[i].serverAirborne || raw.samples[i - 1].serverAirborne) continue;
    const start = i;
    while (i < raw.samples.length && raw.samples[i].serverAirborne) i++;
    const airborne = raw.samples.slice(start, i),
      departure = raw.samples[start - 1],
      landing = raw.samples[i];
    jumpFlights.push({
      samples: airborne.length,
      departureOffset: departure.offsetX,
      landingOffset: landing?.offsetX,
      landingServerOffsetDrift: (landing?.serverOffsetX ?? NaN) - departure.serverOffsetX,
      maxDisplayedRelativeDrift: Math.max(
        ...airborne.map((s) => Math.abs(s.offsetX - departure.offsetX)),
      ),
      departureRoofId: departure.serverRoofId,
      landingRoofId: landing?.serverRoofId,
      landedZ: landing?.serverZ,
      momentumErrorPxPerSecond: stats(airborne.map((s) => Math.abs(s.serverMomentumX - 192))),
      velocity: stats(airborne.map((s) => s.serverVx)),
      hasForward: airborne.some((s) => Math.abs(s.serverVx - 256) < 0.1),
      hasBackward: airborne.some((s) => Math.abs(s.serverVx - 128) < 0.1),
      takeoffStepErrorPx: Math.abs(
        raw.samples[start].playerX -
          departure.playerX -
          (raw.samples[start].playerVx * (raw.samples[start].t - departure.t)) / 1000,
      ),
    });
  }
  const report = {
    jumpFlights,
    revision: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    renderer,
    actualRenderer,
    delayEachWayMs: delay,
    requestedServerHz: serverHz,
    requestedRenderHz: renderHz,
    rateCommands,
    scope:
      "Fresh regional seed 2026, ordinary keyboard roof boarding, real Worker, bundled full Chromium, isolated dev origin; existing server tick-rate CVar; optional timed external render clock, measured wall timestamps; observes current production prediction/authority without overriding them. External 120Hz draws do not certify display refresh or native rAF cadence",
    errors,
    summary: {
      cruiseRenderOffsetX: stats(cruise.map((s) => s.offsetX)),
      cruiseServerOffsetX: stats(cruise.map((s) => s.serverOffsetX)),
      stoppedRenderOffsetX: stats(stopped.map((s) => s.offsetX)),
      cruiseReconcileShiftX: stats(cruiseReconciles.map((s) => s.shiftX)),
      cruiseReconcileShiftAbs: stats(cruiseReconciles.map((s) => Math.hypot(s.shiftX, s.shiftY))),
      cruiseReplayCount: stats(cruiseReconciles.map((s) => s.replayCount)),
      cruiseSpeed: stats(cruise.map((s) => s.speed)),
      cruiseCameraStepX: stats(cruiseSteps.map((s) => s.cameraStep)),
      cruiseCameraVelocityX: stats(cruiseSteps.map((s) => s.cameraVelocity)),
      cruisePlayerStepX: stats(cruiseSteps.map((s) => s.playerStep)),
      cruiseScreenStepX: stats(cruiseSteps.map((s) => s.screenStep)),
      cruiseCameraReverseFrames: cruiseSteps.filter((s) => s.cameraStep < -0.01).length,
      steadyWorldStepErrorPx: stats(
        cruiseSteps.filter((s) => s.steady).map((s) => Math.abs(s.worldStepError)),
      ),
      steadyCameraStepErrorPx: stats(
        cruiseSteps.filter((s) => s.steady).map((s) => Math.abs(s.cameraStepError)),
      ),
      commandDtMs: stats(raw.inputs.map((s) => s.dtMs)),
      renderIntervalMs: stats(raw.samples.slice(1).map((s, i) => s.t - raw.samples[i].t)),
      observedRenderHz:
        ((raw.samples.length - 1) * 1000) / (raw.samples.at(-1).t - raw.samples[0].t),
      observedAuthorityHz:
        ((raw.samples.at(-1).serverTick - raw.samples[0].serverTick) * 1000) /
        (raw.samples.at(-1).t - raw.samples[0].t),
      authorityCadenceByAdvertisedHz: Object.fromEntries(
        [...rateCadence].map(([hz, value]) => [
          hz,
          { ...value, observedHz: (value.ticks * 1000) / value.elapsedMs },
        ]),
      ),
      cruiseScreenSkips: cruiseSkips.length,
      cruiseScreenReverseSkips: cruiseSteps.filter((s) => s.screenStep < -3).length,
      cruiseScreenSkipSpacingMs: stats(cruiseSkips.slice(1).map((s, i) => s.t - cruiseSkips[i].t)),
      invalidAlphaFrames: raw.samples.filter((s) => s.alpha < 0 || s.alpha > 1).length,
      observedTickRates: [...new Set(raw.samples.map((s) => Math.round(s.tickRate)))],
      clockEquationResidualPx: stats(clockResiduals),
      clockGroups: Object.fromEntries(
        [...clockGroups].map(([key, shifts]) => [key, stats(shifts)]),
      ),
    },
    raw: { ...raw, cruiseSteps },
  };
  const output = option("output", path.join(temp, "report.json"));
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ output, ...report.summary, errors }, null, 2));
  if (
    jumpMomentum &&
    !idleJump &&
    (jumpFlights.length !== 2 ||
      jumpFlights.some(
        (f) =>
          f.samples < 20 ||
          f.departureRoofId === undefined ||
          f.landingRoofId === undefined ||
          f.momentumErrorPxPerSecond.count !== f.samples ||
          !Number.isFinite(f.takeoffStepErrorPx) ||
          f.momentumErrorPxPerSecond.max > 0.001 ||
          f.landedZ !== 44 ||
          f.takeoffStepErrorPx > 3.5,
      ) ||
      jumpFlights[0].departureRoofId === jumpFlights[0].landingRoofId ||
      !jumpFlights[1].hasForward ||
      !jumpFlights[1].hasBackward)
  )
    throw Error(`Jump momentum contract: ${JSON.stringify(jumpFlights)}`);

  if (
    idleJump &&
    (jumpFlights.length !== 2 ||
      jumpFlights.some(
        (f) =>
          f.samples < 20 ||
          !Number.isFinite(f.landingServerOffsetDrift) ||
          Math.abs(f.landingServerOffsetDrift) > 0.02 ||
          !Number.isFinite(f.maxDisplayedRelativeDrift) ||
          f.maxDisplayedRelativeDrift > 0.1 ||
          f.landedZ !== 44 ||
          f.departureRoofId !== f.landingRoofId ||
          Math.abs(f.velocity.min - 192) > 0.001 ||
          Math.abs(f.velocity.max - 192) > 0.001,
      ))
  )
    throw Error(`Idle jump relative drift: ${JSON.stringify(jumpFlights)}`);

  if (cruise.length < 180 || errors.length)
    throw Error("Insufficient steady roof cruise or browser errors");
  if (
    renderHz === "120" &&
    (report.summary.observedRenderHz < 110 || report.summary.renderIntervalMs.p50 > 10)
  )
    throw Error(
      "External-clock run did not achieve approximately 120Hz drawing; inspect cadence report",
    );
  if (
    process.argv.includes("--assert-fixed") &&
    (report.summary.invalidAlphaFrames ||
      report.summary.cruiseRenderOffsetX.max - report.summary.cruiseRenderOffsetX.min > 0.01)
  )
    throw Error("Moving roof presentation drift");
  const expectedRates = serverHz === "alternate" ? [30, 60] : [Number(serverHz)];
  if (process.argv.includes("--assert-presentation")) {
    const world = report.summary.steadyWorldStepErrorPx;
    const camera = report.summary.steadyCameraStepErrorPx;
    if (
      world.count < 60 ||
      camera.count < 60 ||
      world.max > 0.05 ||
      camera.max > 0.1 ||
      report.summary.cruiseCameraReverseFrames
    )
      throw Error(`Steady presentation discontinuity: ${JSON.stringify({ world, camera })}`);
  }
  if (expectedRates.some((hz) => !report.summary.observedTickRates.includes(hz)))
    throw Error("Missing advertised server tick-rate samples");
  if (process.argv.includes("--assert-timing")) {
    for (const hz of expectedRates) {
      const cadence = report.summary.authorityCadenceByAdvertisedHz[hz];
      // Include endpoint snapshot quantization on steady sections. This detects
      // the former 60/30Hz timer drift; direct clock tests cover transition time.
      const tolerance = serverHz === "alternate" ? 0.2 : 0.1;
      if (!cadence || Math.abs(cadence.observedHz - hz) > tolerance)
        throw Error(`Authority cadence drift at ${hz}Hz: ${JSON.stringify(cadence)}`);
    }
  }
} finally {
  await browser?.close();
  await server.close();
}
