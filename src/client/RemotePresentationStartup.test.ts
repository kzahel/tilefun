import { expect, it } from "vitest";
import { createTrain } from "../railway/Train.js";
import { RemotePresentation } from "./RemotePresentation.js";

/** Authority loses startup wall time, then delivers a perfect constant-speed stream.
 * Measure only the settled stream: lack of data during the pause may legitimately hold.
 */
function startupTrace(serverHz: number, renderHz: number, pause: number, reset = false) {
  const view = new RemotePresentation();
  const train = createTrain(0, 64);
  view.record([train], 0, 0);
  const steps: number[] = [];
  let tick = 0,
    previous = 0;
  for (let frame = 0; frame <= renderHz * 4; frame++) {
    const now = frame / renderHz;
    const due = Math.max(0, Math.floor((now - pause + 1e-9) * serverHz));
    while (tick < due) {
      tick++;
      train.position.wx = (192 * tick) / serverHz;
      view.record([train], tick / serverHz, pause + tick / serverHz);
    }
    if (reset && frame === renderHz * 2) view.resetClock();
    const x = view.sample([train], now)[0]?.position.wx ?? NaN;
    if (now > 2.5) steps.push(x - previous - 192 / renderHz);
    previous = x;
  }
  return Math.max(...steps.map(Math.abs));
}

it.each([
  [60, 120],
  [30, 120],
  [60, 60],
  [30, 60],
])(
  "keeps the no-pause and explicit visibility-reset controls smooth (%i/%iHz)",
  (serverHz, renderHz) => {
    expect(startupTrace(serverHz, renderHz, 0)).toBeLessThan(1e-9);
    expect(startupTrace(serverHz, renderHz, 0.6, true)).toBeLessThan(1e-9);
  },
);
it("aligned 60Hz authority/display masks the staircase", () => {
  expect(startupTrace(60, 60, 0.6)).toBeLessThan(1e-9);
});
it.each([
  [60, 120],
  [30, 120],
  [30, 60],
])(
  "recovers sustained smooth motion after an unannounced startup pause (%i/%iHz)",
  (serverHz, renderHz) => {
    expect(startupTrace(serverHz, renderHz, 0.6)).toBeLessThan(1e-9);
  },
);

it("anchors the first authority snapshot even when rendering began during loading", () => {
  const view = new RemotePresentation();
  view.sample([], 0.4);
  const train = createTrain(0, 64);
  let previous = 0;
  const errors: number[] = [];
  for (let frame = 0; frame <= 360; frame++) {
    const elapsed = frame / 120;
    if (frame % 2 === 0) {
      train.position.wx = elapsed * 192;
      view.record([train], elapsed, 1.4 + elapsed);
    }
    const x = view.sample([train], 1.4 + elapsed)[0]?.position.wx ?? NaN;
    if (elapsed > 1) errors.push(Math.abs(x - previous - 1.6));
    previous = x;
  }
  expect(Math.max(...errors)).toBeLessThan(1e-9);
});
