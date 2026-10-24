import { useEffect, useRef, useState } from "react";
import { getEntityAABB } from "../entities/collision.js";
import { Direction } from "../entities/Entity.js";
import {
  COLLISION_LAYERS,
  defaultCollisionDebugOptions,
  drawCollisionDebug,
} from "../rendering/CollisionDebug.js";
import { interpolatePosition } from "../rendering/EntityInterpolation.js";
import type { RendererMode } from "../rendering/RenderHost.js";
import { ScenarioPresentationHost } from "../scenarios/ScenarioPresentationHost.js";
import type { ScenarioCommand } from "../scenarios/ScenarioProtocol.js";
import { truckBedRecipe } from "../scenarios/TruckBedRecipe.js";
import { roofSupport } from "../traffic/RoofSupport.js";
import { bedFloorSupport, bedLocalPoint, DUMP_BED } from "../traffic/VehicleBed.js";
import { bedContents } from "../traffic/VehicleCargo.js";

export type TruckBedCanvas = HTMLCanvasElement & {
  __truckBedDiagnostics?: () => ReturnType<ScenarioPresentationHost["getDiagnostics"]> & {
    playerId: number;
    truckId: number | undefined;
    truckPosition: { wx: number; wy: number } | undefined;
    playerZ: number;
    supportId: number | undefined;
    local: { x: number; y: number } | undefined;
    floorZ: number;
    predictedZ: number | undefined;
    cargoCount: number;
    bedTilt: number;
    bedTarget: number;
  };
  __captureTruckBed?: () => HTMLCanvasElement;
};

export default function TruckBedPage() {
  const canvas = useRef<TruckBedCanvas>(null),
    host = useRef<ScenarioPresentationHost | null>(null);
  const keys = useRef(new Set<string>());
  const [direction, setDirection] = useState(Direction.Right);
  const [paused, setPaused] = useState(false),
    [debug, setDebug] = useState(false);
  const [geometry, setGeometry] = useState(() => {
    const options = defaultCollisionDebugOptions();
    options.layers.driving = false;
    options.layers.support = options.layers.sprites = true;
    return options;
  });
  const [status, setStatus] = useState("Loading truck…"),
    [error, setError] = useState("");
  const [moving, setMoving] = useState(false),
    [busy, setBusy] = useState(false);
  const [renderer, setRenderer] = useState<RendererMode>(() => {
    const params = new URLSearchParams(location.search);
    return params.get("renderer") === "canvas"
      ? "canvas"
      : params.get("renderer") === "gpu" && !params.has("meshes")
        ? "gpu"
        : "gpu-mesh";
  });
  const settings = useRef({ paused, debug, geometry });
  settings.current = { paused, debug, geometry };
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    let live = true,
      previousStatus = "";
    setError("");
    setMoving(false);
    keys.current.clear();
    const input = () => ({
      dx:
        Number(keys.current.has("ArrowRight") || keys.current.has("d")) -
        Number(keys.current.has("ArrowLeft") || keys.current.has("a")),
      dy:
        Number(keys.current.has("ArrowDown") || keys.current.has("s")) -
        Number(keys.current.has("ArrowUp") || keys.current.has("w")),
      jump: keys.current.has(" "),
      sprinting: keys.current.has("Shift"),
    });
    const session = new ScenarioPresentationHost(c, truckBedRecipe(direction), {
      width: 768,
      height: 512,
      terrain: true,
      background: "#88a77b",
      defaultRenderer: "gpu-mesh",
      settings: () => ({ paused: settings.current.paused, zoom: 1, terrainPacing: "throughput" }),
      input,
      fixedCamera: (player, alpha) => {
        const truck = session.session.view.entities.find((e) => e.vehicleBed);
        const p = truck
          ? interpolatePosition(truck.position, truck.prevPosition, alpha)
          : player.position;
        return { wx: p.wx, wy: p.wy - 40 };
      },
      overlay: (frame, h) => {
        if (!settings.current.debug) return;
        const truck = h.session.view.entities.find((e) => e.vehicleBed);
        if (!truck) return;
        drawCollisionDebug(
          frame,
          h.camera,
          h.session.view.entities,
          h.session.view.props,
          h.presentedPlayer,
          settings.current.geometry,
          h.presentationAlpha,
          (x, y) => h.session.view.world.getHeightAt(x, y),
        );
      },
      onFrame: (h) => {
        const player = h.presentedPlayer,
          truck = h.session.view.entities.find((e) => e.vehicleBed);
        const local = truck ? bedLocalPoint(truck, player.position) : undefined;
        const supported = !!truck && roofSupport(player, h.session.view.entities)?.id === truck.id;
        const standingInBed =
          supported &&
          !!truck &&
          !!player.collider &&
          Math.abs(
            (player.wz ?? 0) -
              (bedFloorSupport(truck, getEntityAABB(player.position, player.collider)) ??
                -Infinity),
          ) < 0.1;
        const state =
          player.jumpVZ !== undefined
            ? "Airborne"
            : standingInBed
              ? "Standing in bed"
              : supported
                ? "Standing on truck"
                : "On ground";
        const text = settings.current.debug
          ? `${state} | feet ${(player.wz ?? 0).toFixed(1)} | bed floor ${DUMP_BED.floorZ.toFixed(1)}${local ? ` | local ${local.x.toFixed(1)}, ${local.y.toFixed(1)}` : ""}`
          : state;
        if (live && text !== previousStatus) {
          previousStatus = text;
          setStatus(text);
        }
      },
      onError: (e) => {
        if (live) setError(String(e));
      },
    });
    host.current = session;
    c.__truckBedDiagnostics = () => {
      const view = session.session.view,
        player = view.playerEntity,
        truck = view.entities.find((e) => e.vehicleBed);
      return {
        ...session.getDiagnostics(),
        playerId: player.id,
        truckId: truck?.id,
        truckPosition: truck ? { ...truck.position } : undefined,
        playerZ: player.wz ?? 0,
        supportId: roofSupport(player, view.entities)?.id,
        local: truck ? bedLocalPoint(truck, player.position) : undefined,
        floorZ:
          truck && player.collider
            ? (bedFloorSupport(truck, getEntityAABB(player.position, player.collider)) ??
              DUMP_BED.floorZ)
            : DUMP_BED.floorZ,
        bedTilt: truck?.vehicleBedTilt ?? 0,
        bedTarget: truck?.vehicleBedTarget ?? 0,
        predictedZ: session.session.predictor.player?.wz,
        cargoCount: truck ? bedContents(truck, view.entities).length : 0,
      };
    };
    c.__captureTruckBed = () => session.captureFrame();
    void session.ready
      .then(() => {
        if (live) c.dataset.ready = "true";
      })
      .catch((e) => {
        if (live) setError(String(e));
      });
    const clear = () => keys.current.clear();
    window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", clear);
    return () => {
      live = false;
      keys.current.clear();
      session.dispose();
      host.current = null;
      delete c.__truckBedDiagnostics;
      delete c.__captureTruckBed;
      window.removeEventListener("blur", clear);
      document.removeEventListener("visibilitychange", clear);
    };
  }, [direction]);
  const run = async (operation: (h: ScenarioPresentationHost) => Promise<unknown>) => {
    const h = host.current;
    if (!h || busy) return false;
    setBusy(true);
    keys.current.clear();
    try {
      await operation(h);
      return true;
    } catch (e) {
      setError(String(e));
      return false;
    } finally {
      setBusy(false);
      canvas.current?.focus();
    }
  };
  const command = (action: Extract<ScenarioCommand, { kind: "vehicle-bed" }>["action"]) =>
    run((h) => h.command({ kind: "vehicle-bed", action }));
  const hold = (key: string, label: string) => (
    <button
      key={key}
      type="button"
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        keys.current.add(key);
        canvas.current?.focus();
      }}
      onPointerUp={() => keys.current.delete(key)}
      onPointerCancel={() => keys.current.delete(key)}
      onLostPointerCapture={() => keys.current.delete(key)}
      onContextMenu={(e) => e.preventDefault()}
    >
      {label}
    </button>
  );
  return (
    <section>
      <h1>Truck bed playground</h1>
      <p>
        Walk and jump inside a real dump-truck bed, then ride while it moves. WASD / arrows move;
        Space jumps. Tip bed opens the tailgate and lets riders and loose cargo slide out; lower it
        to drive or load again.
      </p>
      <div className="actions">
        <button type="button" disabled={busy} onClick={() => void command("board")}>
          Load into bed
        </button>
        <button type="button" disabled={busy} onClick={() => void command("outside")}>
          Stand beside truck
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            void command(moving ? "stop" : "drive").then((ok) => {
              if (ok) setMoving(!moving);
            });
          }}
        >
          {moving ? "Stop truck" : "Drive truck"}
        </button>
        <button type="button" onClick={() => setPaused(!paused)}>
          {paused ? "Resume" : "Pause"}
        </button>
        <button type="button" disabled={!paused || busy} onClick={() => void run((h) => h.step())}>
          Step
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            void run((h) => h.session.reload()).then((ok) => {
              if (ok) setMoving(false);
            })
          }
        >
          Reload
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void run((h) => h.session.reload(true)).then(() => setMoving(false))}
        >
          Reset
        </button>
      </div>
      <div
        className="actions"
        style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}
      >
        <label>
          Truck heading{" "}
          <select
            style={{ width: "auto", minWidth: 130 }}
            aria-label="Truck heading"
            value={direction}
            onChange={(e) => setDirection(Number(e.target.value) as Direction)}
          >
            <option value={Direction.Right}>Right</option>
            <option value={Direction.Down}>Down</option>
            <option value={Direction.Left}>Left</option>
            <option value={Direction.Up}>Up</option>
          </select>
        </label>
        <label>
          Renderer{" "}
          <select
            style={{ width: "auto", minWidth: 170 }}
            aria-label="Truck renderer"
            disabled={busy}
            value={renderer}
            onChange={(e) => {
              const mode = e.target.value as RendererMode;
              void run(async (h) => setRenderer(await h.selectRenderer(mode)));
            }}
          >
            <option value="gpu-mesh">3D truck</option>
            <option value="canvas">Sprite fallback</option>
            <option value="gpu">GPU sprite fallback</option>
          </select>
        </label>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <input
            style={{ width: "auto", margin: 0 }}
            type="checkbox"
            checked={debug}
            onChange={(e) => setDebug(e.target.checked)}
          />{" "}
          Show clipping geometry
        </label>
      </div>
      <p role="status">{status}</p>
      {error && <p role="alert">{error}</p>}
      <div style={{ position: "relative", width: 768, maxWidth: "100%" }}>
        <canvas
          key={direction}
          ref={canvas}
          width={768}
          height={512}
          tabIndex={0}
          aria-label="Truck bed scene"
          style={{ width: "100%", imageRendering: "pixelated", touchAction: "none" }}
          onPointerDown={(e) => e.currentTarget.focus()}
          onKeyDown={(e) => {
            if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].includes(e.key))
              e.preventDefault();
            keys.current.add(e.key);
          }}
          onKeyUp={(e) => keys.current.delete(e.key)}
          onBlur={() => keys.current.clear()}
        />
      </div>
      <fieldset className="actions" aria-label="Movement controls">
        {hold("ArrowLeft", "Left")}
        {hold("ArrowUp", "Up")}
        {hold("ArrowDown", "Down")}
        {hold("ArrowRight", "Right")}
        {hold(" ", "Jump")}
      </fieldset>
      {debug && (
        <fieldset aria-label="Collision layers">
          <legend>Collision layers · lines show through artwork</legend>
          {Object.entries(COLLISION_LAYERS).map(([key, layer]) => {
            const id = key as keyof typeof COLLISION_LAYERS;
            return (
              <label key={key} style={{ display: "block" }} title={layer.hint}>
                <input
                  type="checkbox"
                  checked={geometry.layers[id]}
                  onChange={(e) =>
                    setGeometry({
                      ...geometry,
                      layers: { ...geometry.layers, [id]: e.target.checked },
                    })
                  }
                />
                <span style={{ color: layer.color }}> ━ </span>
                {layer.label} — {layer.hint}
              </label>
            );
          })}
          <label>
            <input
              type="checkbox"
              checked={geometry.labels}
              onChange={(e) => setGeometry({ ...geometry, labels: e.target.checked })}
            />{" "}
            Shape names & heights
          </label>
          <p>
            Green tops can support feet. White cross: your feet. Terrain collision is not shown.
          </p>
        </fieldset>
      )}
      <p>
        Stand beside the stopped truck to load nearby loose balls or food with the game controls.
        Ride in bed, climb out, or unload the same objects. Pause locks the game controls. Tipping
        and enclosed passenger seats come later.
      </p>
      <a href="/tilefun/workshop.html#/tool/world-geometry">Other geometry playgrounds</a>
    </section>
  );
}
