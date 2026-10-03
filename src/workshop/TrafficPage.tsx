import { useEffect, useRef, useState } from "react";
import { required } from "../art/ArtCatalog.js";
import { closeAssets, loadGameAssets, loadSceneAssets } from "../assets/GameAssets.js";
import { Camera } from "../rendering/Camera.js";
import { drawScene2D } from "../rendering/Canvas2DRenderer.js";
import { collectScene } from "../rendering/collectScene.js";
import { TileRenderer } from "../rendering/TileRenderer.js";
import { TRAFFIC_DEMO_GENERATION, TrafficScene } from "../traffic/TrafficScene.js";

export default function TrafficPage() {
  const canvas = useRef<HTMLCanvasElement>(null),
    scene = useRef<TrafficScene | null>(null),
    keys = useRef(new Set<string>());
  const [error, setError] = useState(""),
    [restart, setRestart] = useState(0),
    [paused, setPaused] = useState(false);
  const pause = useRef(false);
  pause.current = paused;
  useEffect(() => {
    let alive = true,
      raf = 0;
    const s = new TrafficScene();
    if (restart > 0) setPaused(false);
    scene.current = s;
    keys.current.clear();
    const camera = new Camera(),
      renderer = new TileRenderer();
    camera.setViewport(960, 600);
    camera.zoom = 0.75;
    const center = () => camera.snapTo(s.player.position.wx, s.player.position.wy - 12);
    center();
    s.load(camera.getVisibleChunkRange());
    const pending = loadGameAssets(s.blend);
    void pending
      .then(async (assets) => {
        await loadSceneAssets(assets, new Set(s.props.props.map((p) => p.type)));
        if (!alive) {
          closeAssets(assets);
          return;
        }
        const c = required(canvas.current),
          ctx = required(c.getContext("2d"));
        c.width = 960;
        c.height = 600;
        c.dataset.ready = "true";
        let last = performance.now(),
          accumulator = 0,
          loadTimer = 0;
        const frame = (now: number) => {
          if (!alive) return;
          const elapsed = Math.min(0.1, (now - last) / 1000);
          last = now;
          if (!pause.current) accumulator += elapsed;
          while (accumulator >= 1 / 60) {
            const k = keys.current;
            s.step({
              dx:
                Number(k.has("ArrowRight") || k.has("d")) -
                Number(k.has("ArrowLeft") || k.has("a")),
              dy: Number(k.has("ArrowDown") || k.has("s")) - Number(k.has("ArrowUp") || k.has("w")),
              jump: k.has(" "),
              sprinting: false,
            });
            accumulator -= 1 / 60;
          }
          center();
          const range = camera.getVisibleChunkRange();
          loadTimer -= elapsed;
          if (loadTimer <= 0) {
            s.load(range);
            void loadSceneAssets(assets, new Set(s.props.props.map((p) => p.type))).catch((e) =>
              setError(String(e)),
            );
            loadTimer = 0.3;
          }
          ctx.imageSmoothingEnabled = false;
          ctx.fillStyle = "#cbd5c3";
          ctx.fillRect(0, 0, c.width, c.height);
          renderer.prepareTerrain(camera, s.world, assets.sheets, range, 4, 256);
          renderer.drawTerrain(ctx, camera, s.world, assets.sheets, range);
          drawScene2D(
            ctx,
            camera,
            collectScene(
              s.entities.entities,
              s.props.props,
              s.world,
              camera,
              range,
              1,
              renderer,
              [],
              false,
            ),
            assets.sheets,
            undefined,
          );
          c.dataset.playerZ = String(s.player.wz ?? 0);
          c.dataset.carX = String(s.car.entity.position.wx);
          c.dataset.carY = String(s.car.entity.position.wy);
          c.dataset.speed = String(s.car.speed);
          c.dataset.waiting = s.car.waiting;
          c.dataset.cars = String(s.traffic.states.size);
          c.dataset.playerX = String(s.player.position.wx);
          c.dataset.playerY = String(s.player.position.wy);
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
      window.removeEventListener("blur", release);
      keys.current.clear();
      void pending.then(closeAssets).catch(() => {});
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
            scene.current?.standAhead();
            canvas.current?.focus();
          }}
        >
          Stand ahead
        </button>
        <button
          type="button"
          onClick={() => {
            scene.current?.standOnRoof();
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
              if (scene.current) scene.current.traffic.settings.speed = Number(e.target.value);
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
              if (scene.current) scene.current.traffic.settings.gap = Number(e.target.value);
            }}
          />
        </label>
      </div>
      {error ? <p role="alert">{error}</p> : null}
      <canvas
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
