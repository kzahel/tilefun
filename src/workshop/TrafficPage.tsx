import { useEffect, useRef, useState } from "react";
import { required } from "../art/ArtCatalog.js";
import { closeAssets, loadGameAssets, loadSceneAssets } from "../assets/GameAssets.js";
import { BlendGraph } from "../autotile/BlendGraph.js";
import { Camera } from "../rendering/Camera.js";
import { CanvasRenderBackend } from "../rendering/CanvasRenderBackend.js";
import { collectScene } from "../rendering/collectScene.js";
import {
  TERRAIN_PACING,
  type TerrainPacing,
  ZOOM_PRESETS,
} from "../rendering/PresentationSettings.js";
import type { RasterRenderBackend } from "../rendering/RasterRenderBackend.js";
import { collectSceneOrder } from "../rendering/RenderFrame.js";
import { SceneFrame } from "../rendering/SceneFrame.js";
import { ScenarioClient } from "../scenarios/ScenarioClient.js";
import { TRAFFIC_DEMO_GENERATION, trafficRecipe } from "../scenarios/TrafficRecipe.js";

export type TrafficCanvas = HTMLCanvasElement & {
  /** Read-only, on-demand diagnostics for lab profiling and integration checks. */
  __terrainDiagnostics?: () => ReturnType<RasterRenderBackend["getDiagnostics"]>;
};

export default function TrafficPage() {
  const canvas = useRef<TrafficCanvas>(null),
    scene = useRef<ScenarioClient | null>(null),
    keys = useRef(new Set<string>());
  const [error, setError] = useState(""),
    [restart, setRestart] = useState(0),
    [paused, setPaused] = useState(false);
  const [zoom, setZoom] = useState(0.75);
  const [terrainPacing, setTerrainPacing] = useState<TerrainPacing>("throughput");
  const presentation = useRef({ zoom, terrainPacing });
  presentation.current.zoom = zoom;
  presentation.current.terrainPacing = terrainPacing;
  const pause = useRef(false);
  pause.current = paused;
  useEffect(() => {
    const c = required(canvas.current);
    let alive = true,
      raf = 0;
    const s = new ScenarioClient(trafficRecipe());
    const blend = new BlendGraph();
    if (restart > 0) setPaused(false);
    scene.current = s;
    keys.current.clear();
    const camera = new Camera();
    let renderer: RasterRenderBackend | null = null;
    const sceneFrame = new SceneFrame();
    const order: number[] = [];
    camera.setViewport(960, 600);
    camera.zoom = 0.75;
    const center = () =>
      camera.snapTo(s.view.playerEntity.position.wx, s.view.playerEntity.position.wy - 12);
    const pending = loadGameAssets(blend);
    void pending
      .then(async (assets) => {
        await s.ready;
        center();
        await loadSceneAssets(assets, new Set(s.view.props.map((p) => p.type)));
        if (!alive) {
          closeAssets(assets);
          return;
        }
        const GpuBackend =
          new URLSearchParams(location.search).get("renderer") === "gpu"
            ? (await import("../rendering/GpuRenderBackend.js")).GpuRenderBackend
            : null;
        if (!alive) {
          closeAssets(assets);
          return;
        }
        const gpu = GpuBackend ? new GpuBackend(c) : null;
        const backend = gpu ?? new CanvasRenderBackend(required(c.getContext("2d")), assets.sheets);
        if (gpu) {
          gpu.setAssets(assets.sheets);
          gpu.meshes.setEnabled(new URLSearchParams(location.search).has("meshes"));
        }

        renderer = backend;
        c.__terrainDiagnostics = () => backend.getDiagnostics();
        backend.resize(960, 600);
        c.dataset.ready = "true";
        let last = performance.now(),
          accumulator = 0,
          loadTimer = 0;
        const frame = (now: number) => {
          if (!alive) return;
          camera.zoom = presentation.current.zoom;
          const policy = TERRAIN_PACING[presentation.current.terrainPacing];
          const elapsed = Math.min(0.1, (now - last) / 1000);
          last = now;
          if (!pause.current) accumulator += elapsed;
          while (accumulator >= 1 / 60) {
            const k = keys.current;
            s.step(
              {
                dx:
                  Number(k.has("ArrowRight") || k.has("d")) -
                  Number(k.has("ArrowLeft") || k.has("a")),
                dy:
                  Number(k.has("ArrowDown") || k.has("s")) - Number(k.has("ArrowUp") || k.has("w")),
                jump: k.has(" "),
                sprinting: false,
              },
              1 / 60,
              camera.getVisibleChunkRange(),
            );
            accumulator -= 1 / 60;
          }
          center();
          const range = camera.getVisibleChunkRange();
          loadTimer -= elapsed;
          if (loadTimer <= 0) {
            s.view.world.computeAutotile(blend, 64);
            void loadSceneAssets(assets, new Set(s.view.props.map((p) => p.type)))
              .then(() => {
                if (alive) backend.addSpriteAssets(assets.sheets);
              })
              .catch((e) => {
                if (alive) setError(String(e));
              });
            loadTimer = 0.3;
          }
          gpu?.beginFrame();
          backend.submit(camera, { kind: "clear", color: "#cbd5c3" });
          // Use gameplay's bounded scheduler. A visible-only pass here would evict
          // its retained halo and restart the same offscreen work every frame.
          backend.prepareTerrain(camera, s.view.world, range, policy.preparation);
          backend.submit(camera, {
            kind: "terrain",
            draws: backend.collectTerrain(camera, s.view.world, range, policy.drawing),
          });
          const items = collectScene(
            s.view.entities,
            s.view.props,
            s.view.world,
            camera,
            range,
            1,
            backend,
            [],
            false,
            undefined,
            undefined,
            sceneFrame,
          );
          backend.submit(camera, { kind: "scene", items, order: collectSceneOrder(items, order) });
          sceneFrame.release();
          if (gpu) c.dataset.meshDraws = String(gpu.meshes.draws);
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
          raf = requestAnimationFrame(frame);
        };
        raf = requestAnimationFrame(frame);
      })
      .catch((e) => {
        if (alive) setError(String(e));
      });
    const release = () => keys.current.clear();
    window.addEventListener("blur", release);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      delete c.__terrainDiagnostics;
      delete c.dataset.ready;
      renderer?.dispose();
      sceneFrame.clear();
      window.removeEventListener("blur", release);
      keys.current.clear();
      void pending.then(closeAssets).catch(() => {});
      s.dispose();
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
      <canvas
        key={restart}
        ref={canvas}
        aria-label="Generated traffic playground"
        tabIndex={0}
        style={{ width: "100%", maxWidth: 960, touchAction: "none", borderRadius: 12 }}
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
