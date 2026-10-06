/** Observe normal refresh; a separate explicit reset control isolates clock recovery. */
export async function runTrainRefreshProbe(page, origin, renderer) {
  const install = () =>
    page.evaluate(() => {
      const game = document.querySelector("#game").__game;
      const presentation = game.remoteView.presentation;
      const sample = presentation.sample;
      const render = game.loop.callbacks.render;
      const restore = game.camera.restoreActual;
      const frames = [];
      let pose, camera;
      presentation.sample = function (entities, now, paused) {
        const result = sample.call(this, entities, now, paused);
        const car = result.find((e) => e.type === "train-curve-proof-v1");
        if (car)
          pose = {
            t: now,
            x: car.position.wx,
            y: car.position.wy,
            vx: car.velocity?.vx ?? 0,
            vy: car.velocity?.vy ?? 0,
            paused,
            latest: this.latest,
            clock: { ...this.clock },
            wanted:
              this.clock.sourceOrigin +
              Math.max(0, now - this.clock.localOrigin) * this.rate -
              0.05,
            playerZ: game.remoteView.serverPlayerEntity.wz,
          };
        return result;
      };
      game.camera.restoreActual = function () {
        camera = { x: this.x, y: this.y };
        return restore.call(this);
      };
      game.loop.callbacks.render = (alpha, now) => {
        pose = camera = undefined;
        render(alpha, now);
        if (pose && camera) frames.push({ ...pose, camera, tick: game.remoteView.serverTick });
      };
      window.finishRefreshProbe = () => {
        presentation.sample = sample;
        game.loop.callbacks.render = render;
        game.camera.restoreActual = restore;
        return frames;
      };
      return {
        clock: presentation.clock,
        latest: presentation.latest,
        now: performance.now() / 1000,
      };
    });
  const collect = async (seconds) => {
    const initial = await install();
    await page.waitForTimeout(seconds * 1000);
    return { initial, frames: await page.evaluate(() => window.finishRefreshProbe()) };
  };
  await page.waitForFunction(() => {
    const g = document.querySelector("#game").__game;
    const car = g.remoteView.serverEntities.find((e) => e.type === "train-curve-proof-v1");
    return car?.velocity?.vx > 191.9;
  });
  const fresh = await collect(4);
  // Establish the saved roof ride; this does not stop/restart simulation or its display clock.
  await page.evaluate(async () => {
    const g = document.querySelector("#game").__game;
    await g.netEmulatedTransport.base.flush();
  });
  await page.evaluate(
    (url) => history.replaceState(null, "", url),
    `${origin}?nogamepad&renderer=${renderer}`,
  );
  await page.reload();
  await page.waitForFunction(() => {
    const g = document.querySelector("#game")?.__game;
    return g?.initDone && g.remoteView.serverPlayerEntity.wz === 44;
  });
  const reloaded = await collect(6);
  // Same presentation reset used by visibilitychange, isolated from browser
  // automation's forced-visible pages. This is a reset control, not a tab-switch test.
  await page.evaluate(() =>
    document.querySelector("#game").__game.remoteView.resetPresentationClock(),
  );
  const resetControl = await collect(6);
  const summarize = ({ frames, initial }) => {
    const errors = [],
      cameraErrors = [],
      leads = [];
    let since;
    for (let i = 1; i < frames.length; i++) {
      const a = frames[i - 1],
        b = frames[i];
      if (a.vx < 191.9 || b.vx < 191.9 || a.vy !== 0 || b.vy !== 0 || a.paused || b.paused) {
        since = undefined;
        continue;
      }
      since ??= a.t;
      if (b.t - since < 1) continue;
      const dt = b.t - a.t;
      errors.push(Math.abs(b.x - a.x - 192 * dt));
      cameraErrors.push(Math.abs(b.camera.x - a.camera.x - 192 * dt));
      leads.push(b.wanted - b.latest);
    }
    return {
      initial,
      frames: frames.length,
      steadySteps: errors.length,
      maxStepError: Math.max(0, ...errors),
      maxCameraStepError: Math.max(0, ...cameraErrors),
      wantedLeadMin: Math.min(...leads),
      wantedLeadMax: Math.max(...leads),
      badSteps: errors.filter((e) => e > 0.1).length,
      renderHz: (frames.length - 1) / (frames.at(-1).t - frames[0].t),
    };
  };
  return {
    summaries: {
      fresh: summarize(fresh),
      reloaded: summarize(reloaded),
      resetControl: summarize(resetControl),
    },
    raw: { fresh, reloaded, resetControl },
  };
}
