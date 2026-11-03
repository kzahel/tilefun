import { useCallback, useEffect, useRef, useState } from "react";
import { GameLoop } from "../core/GameLoop.js";
import type { Movement } from "../input/ActionManager.js";
import {
  CONTROLLER_EVENT,
  type ControllerCommand,
  controllerInput,
} from "../input/ControllerInput.js";
import {
  COOP_CASES,
  COOP_IDLE,
  type CoopCase,
  coopRecipe,
  coopScript,
} from "../scenarios/CoopRecipe.js";
import { ScenarioClient } from "../scenarios/ScenarioClient.js";
import { boardingDistance, isDrivable, occupiedVehicle } from "../traffic/VehicleSeats.js";
import { PhysicsViewport } from "./PhysicsViewport.js";
import "./physics.css";

export default function PhysicsPage() {
  const root = useRef<HTMLElement>(null),
    left = useRef<HTMLCanvasElement>(null),
    right = useRef<HTMLCanvasElement>(null);
  const client = useRef<ScenarioClient | null>(null),
    keys = useRef(new Set<string>());
  const [scene, setScene] = useState<CoopCase>(() => {
      const value = new URLSearchParams(location.search).get("scene");
      return COOP_CASES.find((scene) => scene === value) ?? "push";
    }),
    [seat, setSeat] = useState<0 | 1>(0);
  const [paused, setPaused] = useState(false),
    [script, setScript] = useState(false),
    [rtt, setRtt] = useState(100);
  const [error, setError] = useState(""),
    [status, setStatus] = useState("Loading shared physics…");
  const state = useRef({ seat, paused, script, rtt });
  state.current = { seat, paused, script, rtt };
  const vehicleAction = useCallback(async (recover = false) => {
    const session = client.current,
      seat = state.current.seat;
    if (!session || state.current.paused) return;
    const view = (seat === 1 ? session.guest : session.host)?.view;
    if (!view) return;
    const player = view.playerEntity,
      occupied = occupiedVehicle(player, view.entities);
    const car =
      occupied ??
      view.entities
        .filter(isDrivable)
        .filter((e) => boardingDistance(player, e) <= 32)
        .sort((a, b) => boardingDistance(player, a) - boardingDistance(player, b))[0];
    if (!car) throw Error("Stand beside the car first.");
    await session.command(
      recover
        ? { kind: "recover-vehicle", entityId: car.id, seat }
        : occupied
          ? { kind: "exit-vehicle", seat }
          : { kind: "enter-vehicle", entityId: car.id, seat },
    );
  }, []);
  const control = useCallback((action: () => Promise<unknown>) => {
    setError("");
    void action().catch((reason) => setError(String(reason)));
  }, []);
  useEffect(() => {
    client.current?.setNetwork(rtt, rtt ? 20 : 0);
  }, [rtt]);
  useEffect(() => {
    const a = left.current,
      b = right.current;
    if (!a || !b) return;
    a.dataset.ready = b.dataset.ready = "false";
    let disposed = false,
      tick = 0,
      lastStatus = 0;
    const session = new ScenarioClient(coopRecipe(scene));
    client.current = session;
    const views = [new PhysicsViewport(a), new PhysicsViewport(b)];
    const fail = (reason: unknown) => {
      if (disposed) return;
      setError(String(reason));
      loop.stop();
      try {
        session.setRunning(false);
      } catch {
        /* Failure already displayed. */
      }
    };
    function manualInput(): Movement {
      const k = keys.current,
        pad = controllerInput.movement;
      const canvasFocused = document.activeElement === a || document.activeElement === b;
      return {
        ...COOP_IDLE,
        dx:
          Number(k.has("ArrowRight") || k.has("KeyD")) -
          Number(k.has("ArrowLeft") || k.has("KeyA")) +
          (canvasFocused ? pad.dx : 0),
        dy:
          Number(k.has("ArrowDown") || k.has("KeyS")) -
          Number(k.has("ArrowUp") || k.has("KeyW")) +
          (canvasFocused ? pad.dy : 0),
        jump: k.has("Space") || (canvasFocused && pad.jump),
        sprinting: k.has("ShiftLeft") || (canvasFocused && pad.sprinting),
        reversing: k.has("KeyR"),
      };
    }
    const loop = new GameLoop({
      update() {
        try {
          session.pump();
          session.setRunning(!state.current.paused && !document.hidden);
          if (!state.current.paused && !session.busy) {
            for (const index of [0, 1] as const)
              session.submitInput(
                state.current.script
                  ? coopScript(scene, tick, index)
                  : index === state.current.seat
                    ? manualInput()
                    : COOP_IDLE,
                undefined,
                index,
              );
            tick++;
          }
        } catch (reason) {
          fail(reason);
        }
      },
      render(alpha, now) {
        try {
          for (const index of [0, 1] as const) {
            const replica = index === 0 ? session.host : session.guest;
            if (replica)
              views[index]?.render(
                replica,
                state.current.paused ? 1 : alpha,
                now,
                state.current.paused,
                session.handles.host ?? -1,
                session.handles.guest ?? -1,
              );
          }
          for (const index of [0, 1] as const) {
            const replica = index ? session.guest : session.host,
              canvas = index ? b : a;
            const player = replica?.view.serverPlayerEntity;
            canvas.dataset.ready = String(!!player && player.id !== -1 && !session.busy);
            canvas.dataset.x = String(player?.position.wx ?? 0);
            canvas.dataset.y = String(player?.position.wy ?? 0);
            canvas.dataset.tick = String(replica?.view.physicsState?.tick ?? 0);
            canvas.dataset.epoch = String(replica?.view.physicsState?.epoch ?? 0);
            canvas.dataset.ack = String(replica?.view.lastProcessedInputSeq ?? 0);
          }
          if (now - lastStatus > 0.25) {
            lastStatus = now;
            setStatus(
              [session.host, session.guest]
                .map((replica, index) => {
                  const d = replica?.predictor.recoveryDiagnostics;
                  return `${index ? "Guest" : "Host"}: tick ${replica?.view.physicsState?.tick ?? 0}, ${d?.status ?? "loading"}, replay ${d?.replayStepsThisTick ?? 0}, bodies ${replica?.view.physicsState?.bodies.length ?? 0}`;
                })
                .join("\n"),
            );
          }
        } catch (reason) {
          fail(reason);
        }
      },
    });
    const clear = () => keys.current.clear();
    const visibility = () => {
      clear();
      loop.stop();
      session.setRunning(false);
      if (!document.hidden && !disposed) loop.start();
    };
    const pad = (event: Event) => {
      const command = (event as CustomEvent<ControllerCommand>).detail;
      const focused = document.activeElement;
      if (
        scene === "vehicle" &&
        (focused === a || focused === b) &&
        (command === "interact" || command === "down")
      ) {
        control(() => vehicleAction(command === "down"));
        return;
      }
      if (command === "menu")
        root.current?.querySelector<HTMLButtonElement>(".physics-actions button")?.focus();
      else if (command === "back") (state.current.seat ? b : a).focus();
      else if (command === "edit") {
        const next = state.current.seat === 0 ? 1 : 0;
        setSeat(next);
        (next ? b : a).focus();
      } else if (focused !== a && focused !== b && root.current?.contains(focused)) {
        const buttons = Array.from(
          root.current.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"),
        );
        const index = buttons.indexOf(focused as HTMLButtonElement);
        if (command === "confirm") (focused as HTMLButtonElement).click();
        else if (["up", "down", "left", "right"].includes(command))
          buttons[
            (index + (["up", "left"].includes(command) ? -1 : 1) + buttons.length) % buttons.length
          ]?.focus();
      }
    };
    controllerInput.uiActive = () => document.activeElement !== a && document.activeElement !== b;
    controllerInput.start();
    window.addEventListener(CONTROLLER_EVENT, pad);
    window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", visibility);
    void session.ready
      .then(() => {
        if (disposed) return;
        session.setNetwork(state.current.rtt, state.current.rtt ? 20 : 0);
        loop.start();
      })
      .catch(fail);
    return () => {
      disposed = true;
      loop.stop();
      session.dispose();
      for (const view of views) view.dispose();
      controllerInput.stop();
      controllerInput.uiActive = () => false;
      window.removeEventListener(CONTROLLER_EVENT, pad);
      window.removeEventListener("blur", clear);
      document.removeEventListener("visibilitychange", visibility);
      clear();
      if (client.current === session) client.current = null;
    };
  }, [scene, control, vehicleAction]);
  const touch = (key: string, label: string) => (
    <button
      type="button"
      onPointerDown={(event) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        keys.current.add(key);
      }}
      onPointerUp={(event) => {
        keys.current.delete(key);
        event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onLostPointerCapture={() => keys.current.delete(key)}
    >
      {label}
    </button>
  );
  return (
    <section className="physics-lab pair-lab" ref={root}>
      <header>
        <h1>Shared physics laboratory</h1>
        <p>
          Two ordinary clients, one independently clocked Realm Worker. Blue is the host; orange is
          the guest. Each pane uses its own game predictor. The guest link adds reliable ordered
          delay and seeded jitter.
        </p>
      </header>
      <fieldset className="physics-actions" aria-label="Scenarios">
        {COOP_CASES.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={scene === value}
            onClick={() => {
              setError("");
              setScene(value);
            }}
          >
            {value}
          </button>
        ))}
      </fieldset>
      <fieldset className="physics-actions" aria-label="Simulation controls">
        {[0, 100, 200].map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={rtt === value}
            onClick={() => setRtt(value)}
          >
            Guest RTT {value}ms
          </button>
        ))}
        <button type="button" aria-pressed={paused} onClick={() => setPaused(!paused)}>
          {paused ? "Resume" : "Pause"}
        </button>
        <button
          type="button"
          disabled={!paused}
          onClick={() =>
            control(async () => {
              await client.current?.step(COOP_IDLE, { minCx: -1, maxCx: 0, minCy: -1, maxCy: 0 });
            })
          }
        >
          Step
        </button>
        <button type="button" aria-pressed={script} onClick={() => setScript(!script)}>
          Scripted inputs
        </button>
        <button
          type="button"
          onClick={() =>
            control(async () => {
              await client.current?.reload(true);
            })
          }
        >
          Reset
        </button>
        <button
          type="button"
          onClick={() =>
            control(async () => {
              await client.current?.reload();
            })
          }
        >
          Save / reload
        </button>
      </fieldset>
      <div className="pair-views">
        {([0, 1] as const).map((index) => (
          <div key={index}>
            <h2>{index ? "Guest view" : "Host view"}</h2>
            <button
              type="button"
              aria-pressed={seat === index}
              onClick={() => {
                setSeat(index);
                (index ? right : left).current?.focus();
              }}
            >
              Control {index ? "guest" : "host"}
            </button>
            <div className="physics-stage pair-stage">
              <canvas
                ref={index ? right : left}
                tabIndex={0}
                aria-label={index ? "Guest physics view" : "Host physics view"}
                onFocus={() => {
                  keys.current.clear();
                  setSeat(index);
                }}
                onBlur={() => keys.current.clear()}
                onPointerDown={(event) => event.currentTarget.focus()}
                onKeyDown={(event) => {
                  if (scene === "vehicle" && (event.code === "KeyE" || event.code === "KeyF")) {
                    event.preventDefault();
                    if (!event.repeat) control(() => vehicleAction(event.code === "KeyF"));
                    return;
                  }
                  if (
                    [
                      "KeyW",
                      "KeyA",
                      "KeyS",
                      "KeyD",
                      "ArrowUp",
                      "ArrowDown",
                      "ArrowLeft",
                      "ArrowRight",
                      "Space",
                      "KeyR",
                      "ShiftLeft",
                    ].includes(event.code)
                  ) {
                    event.preventDefault();
                    keys.current.add(event.code);
                  }
                }}
                onKeyUp={(event) => keys.current.delete(event.code)}
              />
            </div>
          </div>
        ))}
      </div>
      {scene === "vehicle" && (
        <div className="physics-actions">
          <button type="button" disabled={paused} onClick={() => control(() => vehicleAction())}>
            Enter / leave car · E / Y
          </button>
          <button
            type="button"
            disabled={paused}
            onClick={() => control(() => vehicleAction(true))}
          >
            Right car · F / D↓
          </button>
        </div>
      )}
      <div className="physics-touch pair-touch">
        <div>
          {touch("ArrowLeft", "←")}
          {touch("ArrowUp", "↑")}
          {touch("ArrowDown", "↓")}
          {touch("ArrowRight", "→")}
        </div>
        {touch("Space", "Jump")}
      </div>
      <p className="physics-hints">
        WASD / arrows + Space. Controller: left stick + A; LB switches player; Menu opens controls;
        D-pad navigates; A confirms; B returns to play. Touch controls move the selected player.
        {scene === "vehicle" &&
          " Enter the car before driving. Both panes follow it; switch player to try the guest controls under latency. "}
      </p>
      {error && <p role="alert">{error}</p>}
      <output className="physics-stats">{status}</output>
    </section>
  );
}
