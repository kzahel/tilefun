import { useEffect, useRef, useState } from "react";
import { required } from "../art/ArtCatalog.js";
import {
  TERRAIN_PACING,
  type TerrainPacing,
  ZOOM_PRESETS,
} from "../rendering/PresentationSettings.js";
import type { TerrainDiagnostics } from "../rendering/RenderFrame.js";
import { ScenarioPresentationHost } from "../scenarios/ScenarioPresentationHost.js";
import { TRAFFIC_DEMO_GENERATION, trafficRecipe } from "../scenarios/TrafficRecipe.js";

export type TrafficCanvas = HTMLCanvasElement & {
  /** Read-only, on-demand diagnostics for lab profiling and integration checks. */
  __terrainDiagnostics?: () => TerrainDiagnostics | undefined;
  __presentationDiagnostics?: () => ReturnType<ScenarioPresentationHost["getDiagnostics"]>;
};

export default function TrafficPage() {
  const canvas = useRef<TrafficCanvas>(null),
    scene = useRef<ScenarioPresentationHost | null>(null),
    keys = useRef(new Set<string>());
  const [error, setError] = useState(""),
    [restart, setRestart] = useState(0),
    [paused, setPaused] = useState(false);
  const [zoom, setZoom] = useState(0.75);
  const [terrainPacing, setTerrainPacing] = useState<TerrainPacing>("throughput");
  const presentation = useRef({ zoom, terrainPacing, paused });
  presentation.current.zoom = zoom;
  presentation.current.terrainPacing = terrainPacing;
  presentation.current.paused = paused;
  useEffect(() => {
    const c = required(canvas.current);
    let alive = true;
    setError("");
    if (restart > 0) setPaused(false);
    keys.current.clear();
    const host = new ScenarioPresentationHost(c, trafficRecipe(), {
      width: 960,
      height: 600,
      cameraOffsetY: -12,
      settings: () => presentation.current,
      input: () => {
        const k = keys.current;
        return {
          dx: Number(k.has("ArrowRight") || k.has("d")) - Number(k.has("ArrowLeft") || k.has("a")),
          dy: Number(k.has("ArrowDown") || k.has("s")) - Number(k.has("ArrowUp") || k.has("w")),
          jump: k.has(" "),
          sprinting: false,
        };
      },
      onError: (e) => {
        delete c.dataset.ready;
        if (alive) setError(String(e));
      },
      onFrame: (h) => {
        const s = h.session;
        const car = s.view.entities.find((e) => e.id === s.handles.car) ?? s.view.playerEntity;
        c.dataset.playerZ = String(s.view.playerEntity.wz ?? 0);
        c.dataset.carX = String(car.position.wx);
        c.dataset.carY = String(car.position.wy);
        c.dataset.speed = String(s.traffic?.speed ?? 0);
        c.dataset.waiting = s.traffic?.waiting ?? "";
        c.dataset.cars = String(
          s.view.entities.filter((e) => e.type.startsWith("vehicle-v1:")).length,
        );
        c.dataset.playerX = String(s.view.playerEntity.position.wx);
        c.dataset.playerY = String(s.view.playerEntity.position.wy);
      },
    });
    scene.current = host;
    void host.ready
      .then(() => {
        if (!alive) return;
        c.__terrainDiagnostics = () => host.getDiagnostics().terrain;
        c.__presentationDiagnostics = () => host.getDiagnostics();
        c.dataset.ready = "true";
      })
      .catch((e) => {
        if (alive) setError(String(e));
      });
    const release = () => keys.current.clear();
    window.addEventListener("blur", release);
    return () => {
      alive = false;
      delete c.__terrainDiagnostics;
      delete c.dataset.ready;
      delete c.__presentationDiagnostics;
      host.dispose();
      window.removeEventListener("blur", release);
      keys.current.clear();
      scene.current = null;
    };
  }, [restart]);
  const touch = (key: string) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      keys.current.add(key);
    },
    onPointerUp: () => keys.current.delete(key),
    onPointerCancel: () => keys.current.delete(key),
    onLostPointerCapture: () => keys.current.delete(key),
  });
  return (
    <section>
      <p className="eyebrow">GENERATED ROADS / MOVING ROOFS</p>
      <h1>Traffic playground</h1>
      <p>
        Cars stop for you in the road. Jump onto a roof and ride away. Walk with arrows/WASD; Space
        jumps. Landing on a roof does not give you driving controls.
      </p>
      <p>
        Use “Stand ahead” to try braking, then jump toward the stopped car. “Start on roof” sets up
        a roof-ride test.
      </p>
      <div className="actions">
        <button
          type="button"
          onClick={() => {
            void scene.current
              ?.command({ kind: "traffic-position", roof: false })
              .catch((e) => setError(String(e)));
            canvas.current?.focus();
          }}
        >
          Stand ahead
        </button>
        <button
          type="button"
          onClick={() => {
            void scene.current
              ?.command({ kind: "traffic-position", roof: true })
              .catch((e) => setError(String(e)));
            canvas.current?.focus();
          }}
        >
          Start on roof
        </button>
        <button type="button" onClick={() => setPaused(!paused)}>
          {paused ? "Resume" : "Pause"}
        </button>
        <button type="button" onClick={() => setRestart(restart + 1)}>
          Reset scene
        </button>
      </div>
      <div className="actions">
        <label>
          Preview speed{" "}
          <input
            key={`speed-${restart}`}
            aria-label="Preview speed"
            type="range"
            min="12"
            max="60"
            defaultValue="36"
            onChange={(e) => {
              void scene.current
                ?.command({ kind: "traffic-settings", speed: Number(e.target.value) })
                .catch((e) => setError(String(e)));
            }}
          />
        </label>
        <label>
          Following gap{" "}
          <input
            key={`gap-${restart}`}
            aria-label="Following gap"
            type="range"
            min="8"
            max="32"
            defaultValue="12"
            onChange={(e) => {
              void scene.current
                ?.command({ kind: "traffic-settings", gap: Number(e.target.value) })
                .catch((e) => setError(String(e)));
            }}
          />
        </label>
      </div>
      <div className="actions">
        <label>
          Zoom preset{" "}
          <select
            aria-label="Zoom preset"
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
          >
            <option value={0.75}>Lab default · ¾×</option>
            {ZOOM_PRESETS.map((p) => (
              <option key={p.key} value={p.zoom}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Terrain pacing{" "}
          <select
            aria-label="Terrain pacing"
            value={terrainPacing}
            onChange={(e) => setTerrainPacing(e.target.value as TerrainPacing)}
          >
            {Object.entries(TERRAIN_PACING).map(([key, policy]) => (
              <option key={key} value={key}>
                {policy.label}
              </option>
            ))}
          </select>
        </label>
        <small>{TERRAIN_PACING[terrainPacing].hint}</small>
      </div>
      {error ? <p role="alert">{error}</p> : null}
      <div style={{ position: "relative", maxWidth: 960, borderRadius: 12, overflow: "hidden" }}>
        <canvas
          key={restart}
          ref={canvas}
          aria-label="Generated traffic playground"
          tabIndex={0}
          style={{ display: "block", width: "100%", touchAction: "none", borderRadius: 12 }}
          onKeyDown={(e) => {
            if (
              ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "a", "s", "d", " "].includes(
                e.key,
              )
            ) {
              keys.current.add(e.key);
              e.preventDefault();
            }
          }}
          onKeyUp={(e) => keys.current.delete(e.key)}
          onBlur={() => keys.current.clear()}
        />
      </div>
      <div className="actions">
        {[
          ["ArrowLeft", "←"],
          ["ArrowUp", "↑"],
          ["ArrowDown", "↓"],
          ["ArrowRight", "→"],
          [" ", "Jump"],
        ].map(([key, label]) => (
          <button
            type="button"
            key={key}
            {...touch(required(key))}
            style={{ touchAction: "none", minHeight: 48, minWidth: 48 }}
          >
            {label}
          </button>
        ))}
      </div>
      <p>
        <a
          href={`/tilefun/?generation=${encodeURIComponent(JSON.stringify(TRAFFIC_DEMO_GENERATION))}`}
        >
          Create a world with traffic
        </a>{" "}
        · Choose “Gentle traffic &amp; roof rides (v11)” in the game’s world menu. Existing worlds
        keep their generation revision.
      </p>
    </section>
  );
}
