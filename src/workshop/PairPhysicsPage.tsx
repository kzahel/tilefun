import { useCallback, useEffect, useRef, useState } from "react";
import { PairHarness } from "../physics/rapier/PairHarness.js";
import type { RemotePresentation } from "../physics/rapier/PairPresentation.js";
import { PairWorkerPort } from "../physics/rapier/PairWorkerPort.js";
import {
  NEUTRAL,
  PAIR_SCENARIOS,
  type PairScenario,
  type PhysicsSeat,
} from "../physics/rapier/PhysicsScenarios.js";
import { PhysicsViewport } from "../physics/rapier/PhysicsViewport.js";
import { initRapier } from "../physics/rapier/RapierWorld.js";
import "./physics.css";

export default function PairPhysicsPage() {
  const [scene, setScene] = useState<PairScenario>("push");
  const [network, setNetwork] = useState(200);
  const [revision, setRevision] = useState(0);
  const [paused, setPaused] = useState(false);
  const [script, setScript] = useState(true);
  const [seat, setSeat] = useState<PhysicsSeat>(0);
  const [shared, setShared] = useState(true);
  const [ghost, setGhost] = useState(false);
  const [remoteMode, setRemoteMode] = useState<RemotePresentation>("buffered");
  const [smooth, setSmooth] = useState(true);
  const [status, setStatus] = useState("Opening two-player Realm…");
  const [statistics, setStatistics] = useState("");
  const controls = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null),
    guest = useRef<HTMLDivElement>(null);
  const harness = useRef<PairHarness | undefined>(undefined);
  const step = useRef<(() => Promise<void>) | undefined>(undefined);
  const held = useRef(new Set<string>());
  const state = useRef({ paused, script, seat, shared, ghost, remoteMode, smooth });
  state.current = { paused, script, seat, shared, ghost, remoteMode, smooth };
  const focusScene = useCallback(() => {
    (state.current.seat === 0 ? host : guest).current?.querySelector("canvas")?.focus();
  }, []);
  useEffect(() => {
    const elements = [host.current, guest.current] as const;
    if (!elements[0] || !elements[1]) return;
    for (const element of elements) if (element) element.dataset.generation = String(revision);
    const views = [
      new PhysicsViewport(elements[0], 2, true),
      new PhysicsViewport(elements[1], 2, true),
    ] as const;
    for (const view of views) view.setZoom(1.8);
    views[0].canvas.setAttribute("aria-label", "Host view. WASD or arrows move, Space jumps.");
    views[1].canvas.setAttribute("aria-label", "Guest view. WASD or arrows move, Space jumps.");
    const port = new PairWorkerPort();
    let disposed = false,
      running = false,
      handle = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let next = performance.now(),
      report = 0,
      painted = "";
    let menu = false,
      previousButtons: boolean[] = [];
    let current: PairHarness | undefined;
    const timings: number[] = [];
    const lastDisplayed: ({ x: number; y: number; z: number } | undefined)[] = [];
    const maxDisplayed = [0, 0];
    const previousCubeX: (number | undefined)[] = [];
    const firstPushGap: (number | undefined)[] = [];
    for (const element of elements) if (element) element.dataset.firstPushGap = "";
    setStatus("Opening two-player Realm…");
    setStatistics("");
    for (const element of elements) if (element) element.dataset.ready = "false";
    const tick = async () => {
      if (!current || disposed || running) return;
      running = true;
      const began = performance.now();
      try {
        await current.step();
      } catch (error) {
        if (!disposed) {
          setStatus(String(error));
          state.current.paused = true;
          setPaused(true);
        }
      } finally {
        running = false;
        timings.push(performance.now() - began);
        if (timings.length > 180) timings.shift();
      }
    };
    step.current = tick;
    const schedule = async () => {
      if (disposed) return;
      if (!state.current.paused && !document.hidden) await tick();
      if (disposed) return;
      // Fixed 60 Hz coordinator with bounded catch-up after a browser stall.
      next = Math.max(next + 1000 / 60, performance.now() - 250);
      timer = setTimeout(
        () => {
          void schedule();
        },
        Math.max(1, Math.ceil(next - performance.now())),
      );
    };
    void (async () => {
      try {
        await initRapier();
        if (disposed) return;
        const initial = await port.open(scene);
        if (disposed) return;
        current = new PairHarness(
          { scene, rtt: network, jitter: network === 200 ? 20 : 0, seed: 713 },
          port,
          initial,
        );
        harness.current = current;
        setStatus("Ready");
        for (const element of elements) if (element) element.dataset.ready = "true";
        next = performance.now();
        void schedule();
      } catch (error) {
        if (!disposed) setStatus(String(error));
      }
    })();
    const clear = () => {
      held.current.clear();
      if (current) current.desired = NEUTRAL;
    };
    const down = (event: KeyboardEvent) => {
      if (!elements.some((element) => element?.contains(document.activeElement))) return;
      if (
        [
          "ArrowUp",
          "ArrowDown",
          "ArrowLeft",
          "ArrowRight",
          "KeyW",
          "KeyA",
          "KeyS",
          "KeyD",
          "Space",
        ].includes(event.code)
      ) {
        event.preventDefault();
        held.current.add(event.code);
      }
    };
    const up = (event: KeyboardEvent) => held.current.delete(event.code);
    const draw = (now: number) => {
      if (disposed) return;
      const pad = [...navigator.getGamepads()].find((p) => p?.connected);
      const buttons = pad?.buttons.map((button) => button.pressed) ?? [];
      const edge = (i: number) => buttons[i] && !previousButtons[i];
      if (edge(9)) {
        menu = !menu;
        if (menu) controls.current?.querySelector("button")?.focus();
        else focusScene();
      }
      if (menu) {
        const options = [
          ...(controls.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []),
        ];
        const selected = options.indexOf(document.activeElement as HTMLButtonElement);
        if (edge(12) || edge(14))
          options[(selected - 1 + options.length) % options.length]?.focus();
        if (edge(13) || edge(15)) options[(selected + 1) % options.length]?.focus();
        if (edge(0)) (document.activeElement as HTMLButtonElement)?.click();
        if (edge(1)) {
          menu = false;
          focusScene();
        }
      } else {
        if (edge(2)) setSeat((value) => (value === 0 ? 1 : 0));
        if (edge(3)) setScript(false);
      }
      previousButtons = buttons;
      if (current) {
        current.script = state.current.script;
        current.controlled = state.current.seat;
        const keys = held.current;
        const axis = (i: number) => (Math.abs(pad?.axes[i] ?? 0) > 0.15 ? (pad?.axes[i] ?? 0) : 0);
        current.desired = menu
          ? NEUTRAL
          : {
              x:
                Number(keys.has("ArrowRight") || keys.has("KeyD")) -
                  Number(keys.has("ArrowLeft") || keys.has("KeyA")) || axis(0),
              z:
                Number(keys.has("ArrowDown") || keys.has("KeyS")) -
                  Number(keys.has("ArrowUp") || keys.has("KeyW")) || axis(1),
              jump: keys.has("Space") || !!buttons[0],
            };
        for (const presentation of current.presentation) {
          presentation.remoteMode = state.current.remoteMode;
          presentation.smooth = state.current.smooth;
        }
        const paintKey = `${current.clients[0].tick}/${current.clients[1].tick}/${current.latest.snapshot.state.motors[0]?.tick}/${state.current.remoteMode}/${state.current.smooth}`;
        if (painted !== paintKey) {
          for (const seat of [0, 1] as const) {
            const poses = current.presentedPoses(seat);
            views[seat].accept(poses, now);
          }
          painted = paintKey;
        }
        for (const seat of [0, 1] as const) {
          const view = views[seat],
            client = current.clients[seat],
            element = elements[seat];
          view.setFocus(state.current.shared ? "shared" : seat === 0 ? 0 : -1);
          view.setPrediction(
            undefined,
            undefined,
            current.received[seat]?.snapshot.state.motors[seat],
            state.current.ghost,
          );
          element?.setAttribute(
            "data-tick",
            String(current.latest.snapshot.state.motors[0]?.tick ?? 0),
          );
          element?.setAttribute(
            "data-authority-x",
            String(current.received[seat]?.snapshot.state.motors[seat]?.x ?? 0),
          );
          element?.setAttribute(
            "data-replica-ack",
            String(current.replicas[seat].lastProcessedInputSeq),
          );
          element?.setAttribute("data-prediction-tick", String(client.tick));
          element?.setAttribute("data-x", String(client.world.motorFor(seat).x));
          element?.setAttribute("data-correction", String(client.diagnostics.correction));
          element?.setAttribute("data-compared-tick", String(client.diagnostics.comparedTick));
          element?.setAttribute(
            "data-current-correction",
            String(client.diagnostics.currentCorrection),
          );
          element?.setAttribute(
            "data-max-current-correction",
            String(client.diagnostics.maxCurrentCorrection),
          );
          element?.setAttribute(
            "data-remote-source",
            current.presentation[seat].diagnostics.remoteSource,
          );
          element?.setAttribute(
            "data-own-source",
            current.presentation[seat].diagnostics.ownSource,
          );
          element?.setAttribute(
            "data-cube-source",
            current.presentation[seat].diagnostics.cubeSource,
          );
          element?.setAttribute(
            "data-cube-display-tick",
            String(current.presentation[seat].diagnostics.cubeDisplayTick),
          );
          element?.setAttribute(
            "data-remote-display-tick",
            String(current.presentation[seat].diagnostics.remoteDisplayTick),
          );
          element?.setAttribute(
            "data-remote-offset",
            String(current.presentation[seat].diagnostics.remoteOffset),
          );
          element?.setAttribute(
            "data-raw-remote-z",
            String(client.world.motorFor(seat === 0 ? 1 : 0).z),
          );
        }
        if (now - report > 250) {
          const sorted = [...timings].sort((a, b) => a - b);
          setStatistics(
            `Authority tick ${current.tick} · ${current.queued} queued messages · ${current.latest.lateInputs} late inputs · Coordinator step p95 ${(sorted[Math.floor(sorted.length * 0.95)] ?? 0).toFixed(2)} ms\n${(
              [0, 1] as const
            )
              .map((seat) => {
                const client = current?.clients[seat];
                if (!client) return "";
                const d = client.diagnostics,
                  p = current?.presentation[seat].diagnostics;
                return `${seat === 0 ? "Host" : "Guest"}: predicted tick ${client.tick} · compared tick ${d.comparedTick} · past error ${(d.correction * 100).toFixed(2)} cm / max ${(d.maxCorrection * 100).toFixed(2)}
Current-pose correction ${(d.currentCorrection * 100).toFixed(2)} cm / max ${(d.maxCurrentCorrection * 100).toFixed(2)} · own ${(d.ownCorrection * 100).toFixed(2)} / remote ${(d.remoteCorrection * 100).toFixed(2)} cm · display offset ${((p?.maxOffset ?? 0) * 100).toFixed(2)} cm · correction release max ${(p?.maxCorrectionReleaseSpeed ?? 0).toFixed(2)} m/s
Remote ${p?.remoteSource} at tick ${p?.remoteDisplayTick} · cube ${p?.cubeSource} at ${p?.cubeDisplayTick} · own ${p?.ownSource} · groups ${p?.predictedGroups} predicted / ${p?.bufferedGroups} buffered
Displayed frame step max ${((maxDisplayed[seat] ?? 0) * 100).toFixed(2)} cm · replay ${d.replaySteps} / ${d.replayMs.toFixed(2)} ms · ${d.pending} pending · ${d.recoveries} recoveries`;
              })
              .join(
                "\n",
              )}\nFull physics snapshot ${(current.latest.snapshot.state.bytes.byteLength / 1024).toFixed(1)} KiB · physics 60 Hz · snapshots delivered 30 Hz`,
          );
          report = now;
        }
      }
      for (const seat of [0, 1] as const) {
        const view = views[seat];
        view.draw(now);
        const position = view.displayedPosition(seat === 0 ? -1 : 0),
          previous = lastDisplayed[seat];
        if (position && previous)
          maxDisplayed[seat] = Math.max(
            maxDisplayed[seat] ?? 0,
            Math.hypot(position.x - previous.x, position.y - previous.y, position.z - previous.z),
          );
        const cube = view.displayedPosition(2),
          oldCubeX = previousCubeX[seat];
        if (
          cube &&
          oldCubeX !== undefined &&
          cube.x - oldCubeX > 0.005 &&
          firstPushGap[seat] === undefined
        ) {
          const cubeBounds = view.displayedBounds(2),
            playerBounds = view.displayedBounds(0);
          if (cubeBounds && playerBounds) {
            firstPushGap[seat] = cubeBounds.min.x - playerBounds.max.x;
            elements[seat]?.setAttribute("data-first-push-gap", String(firstPushGap[seat]));
          }
        }
        previousCubeX[seat] = cube?.x;
        lastDisplayed[seat] = position;
        elements[seat]?.setAttribute("data-displayed-remote-z", String(position?.z ?? 0));
        elements[seat]?.setAttribute("data-max-displayed-step", String(maxDisplayed[seat] ?? 0));
      }
      handle = requestAnimationFrame(draw);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", clear);
    handle = requestAnimationFrame(draw);
    return () => {
      disposed = true;
      clearTimeout(timer);
      cancelAnimationFrame(handle);
      held.current.clear();
      step.current = undefined;
      harness.current = undefined;
      if (current) void current.close();
      else void port.close();
      for (const view of views) view.dispose();
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", clear);
      document.removeEventListener("visibilitychange", clear);
    };
  }, [scene, network, revision, focusScene]);
  const reset = () => {
    held.current.clear();
    setRevision((v) => v + 1);
  };
  const takeControl = (value: PhysicsSeat) => {
    held.current.clear();
    setSeat(value);
    setScript(false);
  };
  const touch = (code: string, label: string) => (
    <button
      type="button"
      aria-label={label}
      onPointerDown={(event) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        setScript(false);
        held.current.add(code);
      }}
      onPointerUp={() => held.current.delete(code)}
      onPointerCancel={() => held.current.delete(code)}
      onLostPointerCapture={() => held.current.delete(code)}
    >
      {label}
    </button>
  );
  return (
    <section className="physics-lab pair-lab">
      <header>
        <p className="physics-kicker">TWO CLIENTS · ONE AUTHORITY · FULL PHYSICS REPLAY</p>
        <h1>Co-op physics laboratory</h1>
        <p>
          Watch both players push the same cube. Take either seat, or replay the exact scripted
          scenario used by native tests. Yellow is the host; pink is the guest.
        </p>
      </header>
      <div className="physics-actions" ref={controls}>
        {PAIR_SCENARIOS.map((item) => (
          <button
            type="button"
            key={item.id}
            aria-pressed={scene === item.id}
            onClick={() => {
              setScene(item.id);
              reset();
            }}
          >
            {item.name}
          </button>
        ))}
        {[0, 100, 200].map((rtt) => (
          <button
            type="button"
            key={rtt}
            aria-pressed={network === rtt}
            onClick={() => {
              setNetwork(rtt);
              reset();
            }}
          >
            {rtt === 0 ? "Guest: local" : `Guest: ${rtt} ms${rtt === 200 ? " + jitter" : ""}`}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={script}
          onClick={() => {
            setScript(true);
            reset();
          }}
        >
          Replay script
        </button>
        <button type="button" onClick={() => setPaused((v) => !v)}>
          {paused ? "Resume" : "Pause"}
        </button>
        <button
          type="button"
          disabled={!paused}
          onClick={() => {
            void step.current?.();
          }}
        >
          Step one tick
        </button>
        <button type="button" onClick={reset}>
          Reset scene
        </button>
        <button type="button" aria-pressed={!script && seat === 0} onClick={() => takeControl(0)}>
          Control host
        </button>
        <button type="button" aria-pressed={!script && seat === 1} onClick={() => takeControl(1)}>
          Control guest
        </button>
        <button type="button" aria-pressed={shared} onClick={() => setShared((v) => !v)}>
          Shared camera
        </button>
        <button type="button" aria-pressed={smooth} onClick={() => setSmooth((value) => !value)}>
          Corrections: {smooth ? "smooth" : "raw"}
        </button>
        <button
          type="button"
          aria-pressed={remoteMode === "buffered"}
          onClick={() => setRemoteMode("buffered")}
        >
          Remote: buffered when clear
        </button>
        <button
          type="button"
          aria-pressed={remoteMode === "predicted"}
          onClick={() => setRemoteMode("predicted")}
        >
          Remote: predicted
        </button>
        <button type="button" aria-pressed={ghost} onClick={() => setGhost((v) => !v)}>
          Authority ghost
        </button>
      </div>
      <p role="status">
        {status} ·{" "}
        {paused
          ? "Paused"
          : script
            ? "Script playing"
            : `Controlling ${seat === 0 ? "host" : "guest"}`}
      </p>
      <div className="pair-views">
        {([0, 1] as const).map((value) => (
          <div key={value}>
            <h2>
              {value === 0
                ? "Host · local integrated authority"
                : `Guest · ${network} ms RTT${network === 200 ? " + jitter" : ""}`}
            </h2>
            <div className="physics-stage pair-stage" ref={value === 0 ? host : guest}>
              <button type="button" className="pair-seat" onClick={() => takeControl(value)}>
                Control {value === 0 ? "host" : "guest"}
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="physics-touch pair-touch">
        <div>
          {touch("ArrowUp", "↑")}
          <div>
            {touch("ArrowLeft", "←")}
            {touch("ArrowDown", "↓")}
            {touch("ArrowRight", "→")}
          </div>
        </div>
        {touch("Space", "Jump")}
      </div>
      <p className="physics-hints">
        Select Control host / guest, then focus its scene. WASD / arrows · Space jump. Controller: Y
        manual, X switch seat, left stick move, A jump, Menu controls, D-pad select, A confirm, B
        back. Touch buttons control the selected seat.
      </p>
      <output className="physics-stats">{statistics}</output>
      <p className="physics-limit">
        Both clients always simulate the complete physics world. Displayed interaction groups share
        one scene time and one rigid correction transform, keeping players and loose bodies aligned.
        Idle clients buffer the scene. Recent local input or an airborne local player predicts its
        connected interaction group; release keeps prediction through the confirmation tail.
        Buffered display adds delay. Joining or splitting groups can correct other members around
        the preserved local anchor. Static-contact smoothing and independent-clock multiplayer
        remain unqualified. Past error measures old-tick agreement; current-pose correction measures
        raw replay changes. The white ghost is the last received authority pose. Seed 713; ordered
        application delay, no packet loss. Pause and Step freeze/advance the shared coordinator
        clock, including network queues. Live playback crosses a real Worker and normal
        Realm/input/replication code, but uses a coordinated clock rather than the game’s
        independent server scheduler. Full snapshots are a correctness reference, not a shipping
        bandwidth or Chromebook performance claim. Characters remain controlled capsules, not freely
        tumbling rigid bodies. Players can push each other with a bounded shared contact response;
        sliding, jumping and walking away remain available, and release stops the push.
      </p>
    </section>
  );
}
