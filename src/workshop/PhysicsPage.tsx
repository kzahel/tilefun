import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { bridgeSections, type PhysicsStart } from "../physics/rapier/BridgeFixture.js";
import { PhysicsLabClient } from "../physics/rapier/PhysicsLabClient.js";
import { PhysicsViewport } from "../physics/rapier/PhysicsViewport.js";
import type { PhysicsDiagnostics } from "../physics/rapier/RapierWorld.js";
import PairPhysicsPage from "./PairPhysicsPage.js";
import "./physics.css";

function SinglePhysicsPage() {
  const [sections, setSections] = useState(() =>
    bridgeSections(Number(new URLSearchParams(location.search).get("sections") || 8)),
  );
  const [revision, setRevision] = useState(0),
    [status, setStatus] = useState("Loading physics…");
  const [paused, setPaused] = useState(false),
    [statistics, setStatistics] = useState("Waiting for authority…");
  const [details, setDetails] = useState<PhysicsDiagnostics>();
  const stage = useRef<HTMLDivElement>(null),
    controls = useRef<HTMLDivElement>(null);
  const client = useRef<PhysicsLabClient | undefined>(undefined);
  const viewport = useRef<PhysicsViewport | undefined>(undefined);
  const held = useRef(new Set<string>());
  const latest = useRef<PhysicsDiagnostics | undefined>(undefined);
  const pausedByUser = useRef(false);
  const network = useRef({ rtt: 0, jitter: 0 });
  const [networkLabel, setNetworkLabel] = useState("Local");
  const displayPrediction = useRef(true),
    displayGhost = useRef(false);
  const [predictedView, setPredictedView] = useState(true),
    [showGhost, setShowGhost] = useState(false);

  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    element.dataset.revision = String(revision);
    element.dataset.ready = "false";
    setStatus("Loading physics…");
    setPaused(false);
    pausedByUser.current = false;
    held.current.clear();
    let view: PhysicsViewport;
    try {
      view = new PhysicsViewport(element, sections);
    } catch (error) {
      setStatus(`Failed: ${error}`);
      return;
    }
    viewport.current = view;
    const replayTimes: number[] = [];
    const realmTimes: number[] = [],
      packingTimes: number[] = [];
    let completedReplays = 0;
    const tickTimes: number[] = [],
      frameTimes: number[] = [];
    const connection = new PhysicsLabClient(
      sections,
      (poses, diagnostic) => {
        view.accept(poses, performance.now());
        latest.current = diagnostic;
        element.dataset.tick = String(diagnostic.tick);
        element.dataset.x = String(diagnostic.playerX);
        element.dataset.z = String(diagnostic.playerZ);
        element.dataset.feet = String(diagnostic.feetY);
        element.dataset.sections = String(diagnostic.sections);
        element.dataset.bodies = String(diagnostic.bodies);
        tickTimes.push(diagnostic.stepMs);
        if (tickTimes.length > 180) tickTimes.shift();
        realmTimes.push(diagnostic.realmTickMs ?? 0);
        packingTimes.push(diagnostic.publishMs ?? 0);
        if (realmTimes.length > 180) realmTimes.shift();
        if (packingTimes.length > 180) packingTimes.shift();
      },
      (nextStatus) => {
        setStatus(nextStatus);
        element.dataset.ready = String(nextStatus === "Running");
      },
    );
    client.current = connection;
    connection.setLatency(network.current.rtt, network.current.jitter);
    connection.showPrediction = displayPrediction.current;
    let handle = 0,
      last = performance.now(),
      report = last,
      sent = 0;
    let previousButtons: boolean[] = [],
      controllerMenu = false;
    const percentile = (samples: number[], p: number) =>
      [...samples].sort((a, b) => a - b)[Math.floor((samples.length - 1) * p)] ?? 0;
    const draw = (now: number) => {
      const pad = navigator.getGamepads?.().find((p) => p?.connected);
      const buttons = pad?.buttons.map((b) => b.pressed) ?? [];
      const edge = (i: number) => buttons[i] && !previousButtons[i];
      if (edge(9)) {
        controllerMenu = !controllerMenu;
        if (controllerMenu) controls.current?.querySelector<HTMLButtonElement>("button")?.focus();
        else view.canvas.focus({ preventScroll: true });
      }
      if (!controllerMenu && edge(2)) connection.send({ type: "spawn", count: 25 });
      if (controllerMenu) {
        const options = [
          ...(controls.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []),
        ];
        const selected = options.indexOf(document.activeElement as HTMLButtonElement);
        if (edge(12) || edge(14))
          options[(selected - 1 + options.length) % options.length]?.focus();
        if (edge(13) || edge(15)) options[(selected + 1) % options.length]?.focus();
        if (edge(0)) (document.activeElement as HTMLButtonElement)?.click();
        if (edge(1)) {
          controllerMenu = false;
          view.canvas.focus({ preventScroll: true });
        }
      }
      if (now - sent >= 16) {
        const keys = held.current;
        const axis = (i: number) => (Math.abs(pad?.axes[i] ?? 0) > 0.15 ? (pad?.axes[i] ?? 0) : 0);
        const x =
          Number(keys.has("ArrowRight") || keys.has("KeyD")) -
          Number(keys.has("ArrowLeft") || keys.has("KeyA"));
        const z =
          Number(keys.has("ArrowDown") || keys.has("KeyS")) -
          Number(keys.has("ArrowUp") || keys.has("KeyW"));
        connection.input(
          controllerMenu
            ? { x: 0, z: 0, jump: false }
            : { x: x || axis(0), z: z || axis(1), jump: keys.has("Space") || !!buttons[0] },
        );
        sent = now;
      }
      previousButtons = buttons;
      connection.advance(now);
      view.setPrediction(
        connection.showPrediction ? connection.motor : undefined,
        connection.predictedPlatformY,
        connection.authorityMotor,
        displayGhost.current,
      );
      const prediction = connection.predictor.diagnostics;
      if (prediction.reconciles !== completedReplays) {
        completedReplays = prediction.reconciles;
        replayTimes.push(prediction.completedReplayMs);
        if (replayTimes.length > 180) replayTimes.shift();
      }
      element.dataset.predictedX = String(connection.predictor.motor?.x ?? 0);
      element.dataset.displayX = String(connection.motor?.x ?? 0);
      element.dataset.pending = String(prediction.pending);
      element.dataset.ack = String(prediction.ack);
      element.dataset.sent = String(connection.lastSequence);
      element.dataset.recovery = String(connection.recoveries);
      element.dataset.predictionStatus = prediction.status;
      element.dataset.engineAck = String(connection.view.lastProcessedInputSeq);
      element.dataset.engineX = String(connection.view.serverPlayerEntity.position.wx);
      const render = view.draw(now);
      frameTimes.push(now - last);
      if (frameTimes.length > 180) frameTimes.shift();
      last = now;
      if (now - report > 500) {
        element.dataset.draws = String(render.calls);
        element.dataset.visible = String(render.visible);
        element.dataset.total = String(render.total);
        setStatistics(
          `${(1000 / (frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length)).toFixed(0)} FPS · frame p95 ${percentile(frameTimes, 0.95).toFixed(1)} ms · physics p95 ${percentile(tickTimes, 0.95).toFixed(2)} ms · ${render.calls} draws · ${render.visible}/${render.total} visible static sections\nRealm tick p95 ${percentile(realmTimes, 0.95).toFixed(2)} ms · pose packing p95 ${percentile(packingTimes, 0.95).toFixed(2)} ms\nPrediction ${prediction.status} · ack ${prediction.ack} · ${prediction.pending} pending · ack age ${prediction.ackAgeMs.toFixed(0)} ms · correction ${(prediction.correctionMetres * 100).toFixed(2)} cm (max ${(prediction.maxCorrectionMetres * 100).toFixed(2)}) · support-relative ${(prediction.relativeCorrectionMetres * 100).toFixed(2)} cm\nReplay total p95 ${percentile(replayTimes, 0.95).toFixed(2)} ms · slice ${prediction.replayMs.toFixed(2)} ms / ${prediction.replaySteps} steps · ${prediction.collisionCount} local colliders (${prediction.omittedBodies} omitted nearby bodies) · ${connection.queued} delayed packets · ${connection.recoveries} stall recoveries · Realm ack ${connection.view.lastProcessedInputSeq}`,
        );
        setDetails(latest.current);
        report = now;
      }
      handle = requestAnimationFrame(draw);
    };
    const down = (event: KeyboardEvent) => {
      if (!element.contains(document.activeElement)) return;
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
      if (event.code === "KeyX" && !event.repeat) connection.send({ type: "spawn", count: 25 });
    };
    const up = (event: KeyboardEvent) => held.current.delete(event.code);
    const clear = () => {
      held.current.clear();
      connection.input({ x: 0, z: 0, jump: false });
    };
    const visibility = () => {
      clear();
      connection.send({ type: "pause", paused: document.hidden || pausedByUser.current });
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", visibility);
    handle = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(handle);
      connection.dispose();
      view.dispose();
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", clear);
      document.removeEventListener("visibilitychange", visibility);
      held.current.clear();
      latest.current = undefined;
      if (client.current === connection) client.current = undefined;
      if (viewport.current === view) viewport.current = undefined;
    };
  }, [sections, revision]);

  const go = (start: PhysicsStart) => {
    held.current.clear();
    client.current?.input({ x: 0, z: 0, jump: false });
    client.current?.send({ type: "teleport", start });
    stage.current?.querySelector("canvas")?.focus({ preventScroll: true });
  };
  const latency = (label: string, rtt: number, jitter: number) => {
    network.current = { rtt, jitter };
    setNetworkLabel(label);
    client.current?.setLatency(rtt, jitter);
  };
  const touch = (key: string, label: string) => (
    <button
      type="button"
      aria-label={label}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        held.current.add(key);
      }}
      onPointerUp={() => held.current.delete(key)}
      onPointerCancel={() => held.current.delete(key)}
      onLostPointerCapture={() => held.current.delete(key)}
    >
      {label}
    </button>
  );
  return (
    <section className="physics-lab">
      <header>
        <p className="physics-kicker">ENGINE EXPERIMENT · RAPIER / WASM</p>
        <h1>3D physics playground</h1>
        <p>
          Walk up the gold ramp, cross the blue bridge or pass underneath. Push the loose objects.
          The teal lift moves beside the entrance.
        </p>
      </header>
      <div className="physics-actions" ref={controls}>
        <button type="button" onClick={() => go("ramp")}>
          Ramp start
        </button>
        <button type="button" onClick={() => go("deck")}>
          On bridge
        </button>
        <button type="button" onClick={() => go("underpass")}>
          Under bridge
        </button>
        <button type="button" onClick={() => go("platform")}>
          Moving lift
        </button>
        <button type="button" onClick={() => go("far")}>
          Far end
        </button>
        <button type="button" onClick={() => client.current?.send({ type: "spawn", count: 25 })}>
          Drop 25 objects · X
        </button>
        <button
          type="button"
          onClick={() => {
            pausedByUser.current = !pausedByUser.current;
            client.current?.send({
              type: "pause",
              paused: document.hidden || pausedByUser.current,
            });
            setPaused(pausedByUser.current);
          }}
        >
          {paused ? "Resume" : "Pause"}
        </button>
        <button type="button" onClick={() => setRevision((r) => r + 1)}>
          Reset
        </button>
        {[8, 64, 256].map((count) => (
          <button
            key={count}
            type="button"
            aria-pressed={sections === count}
            onClick={() => {
              setSections(count);
              if (sections === count) setRevision((r) => r + 1);
            }}
          >
            {count * 4} m bridge
          </button>
        ))}
        <button type="button" aria-label="Zoom in" onClick={() => viewport.current?.setZoom(1.25)}>
          Zoom +
        </button>
        <button type="button" aria-label="Zoom out" onClick={() => viewport.current?.setZoom(0.8)}>
          Zoom −
        </button>
        <button type="button" onClick={() => viewport.current?.toggleCutaway()}>
          See through deck
        </button>
        <button
          type="button"
          aria-pressed={networkLabel === "Local"}
          onClick={() => latency("Local", 0, 0)}
        >
          Local network
        </button>
        <button
          type="button"
          aria-pressed={networkLabel === "100 ms"}
          onClick={() => latency("100 ms", 100, 0)}
        >
          100 ms RTT
        </button>
        <button
          type="button"
          aria-pressed={networkLabel === "200 ms + jitter"}
          onClick={() => latency("200 ms + jitter", 200, 20)}
        >
          200 ms RTT + jitter
        </button>
        <button
          type="button"
          aria-pressed={predictedView}
          onClick={() => {
            displayPrediction.current = !displayPrediction.current;
            setPredictedView(displayPrediction.current);
            if (client.current) client.current.showPrediction = displayPrediction.current;
          }}
        >
          {predictedView ? "View: predicted" : "View: authority"}
        </button>
        <button
          type="button"
          aria-pressed={showGhost}
          onClick={() => {
            displayGhost.current = !displayGhost.current;
            setShowGhost(displayGhost.current);
          }}
        >
          Authority ghost
        </button>
        <button
          type="button"
          onClick={() => client.current?.send({ type: "stall", milliseconds: 500 })}
        >
          Stall authority 500 ms
        </button>
        <button
          type="button"
          onClick={() => {
            const until = performance.now() + 500;
            while (performance.now() < until) {
              /* Diagnostic only. */
            }
          }}
        >
          Stall client 500 ms
        </button>
        <button type="button" onClick={() => client.current?.send({ type: "resync" })}>
          Resync now
        </button>
      </div>
      <div className="physics-stage" ref={stage}>
        <div className="physics-badge" role="status">
          {paused ? "Paused" : status}
        </div>
        <div className="physics-touch">
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
      </div>
      <p className="physics-hints">
        Click the scene to walk · WASD / arrows · Space jump · Controller: left stick, A jump, Menu
        controls, D-pad select, A confirm, B back
      </p>
      <output className="physics-stats">
        {statistics}
        <br />
        {details
          ? `Tick ${details.tick} · ${details.colliders} colliders · ${details.bodies} bodies · ${details.sleeping} sleeping · feet ${details.feetY.toFixed(2)} m · ${details.grounded ? "grounded" : "airborne"}`
          : ""}
      </output>
      <p className="physics-limit">
        Provisional backend: a real TypeScript Realm uses WASM physics; the client replays
        unacknowledged inputs in a nearby collision world. Private memory, no SAB. Network controls
        add ordered application delay in both directions. View selection compares responsiveness
        while prediction keeps running. Loose bodies use short velocity proxies, so pushing can
        correct. All authority geometry is resident; streaming, normal-game rendering, general
        multiplayer and Chromebook performance remain unqualified.
      </p>
    </section>
  );
}

export default function PhysicsPage() {
  const [params] = useSearchParams();
  return (
    <>
      <nav className="physics-mode">
        <a href="#/tool/physics">Co-op laboratory</a>
        <a href="#/tool/physics?mode=single">Bridge and scale experiment</a>
      </nav>
      {params.get("mode") === "single" ? <SinglePhysicsPage /> : <PairPhysicsPage />}
    </>
  );
}
