import { useEffect, useRef, useState } from "react";
import { required } from "../art/ArtCatalog.js";
import {
  describeSurfaceSupport,
  type SurfaceVisibility,
} from "../rendering/SurfacePresentation.js";
import { ScenarioPresentationHost } from "../scenarios/ScenarioPresentationHost.js";
import { GEOMETRY_STARTS, worldGeometryRecipe } from "../scenarios/WorldGeometryRecipe.js";

export default function WorldGeometryPage() {
  const canvas = useRef<HTMLCanvasElement>(null),
    scene = useRef<ScenarioPresentationHost | null>(null);
  const keys = useRef(new Set<string>());
  const [error, setError] = useState(""),
    [restart, setRestart] = useState(0);
  const [paused, setPaused] = useState(false),
    [visibility, setVisibility] = useState<SurfaceVisibility>("auto");
  const [status, setStatus] = useState("Loading scene…");
  const settings = useRef({ paused, visibility });
  settings.current = { paused, visibility };
  useEffect(() => {
    const c = required(canvas.current);
    let alive = true,
      lastStatus = "";
    setError("");
    if (restart > 0) setPaused(false);
    keys.current.clear();
    const host = new ScenarioPresentationHost(c, worldGeometryRecipe(), {
      width: 960,
      height: 640,
      fixedCamera: { wx: -16, wy: -16 },
      terrain: false,
      surfaceVisibility: () => settings.current.visibility,
      settings: () => ({
        paused: settings.current.paused,
        zoom: 0.625,
        terrainPacing: "throughput",
      }),
      input: () => ({
        dx:
          Number(keys.current.has("ArrowRight") || keys.current.has("d")) -
          Number(keys.current.has("ArrowLeft") || keys.current.has("a")),
        dy:
          Number(keys.current.has("ArrowDown") || keys.current.has("s")) -
          Number(keys.current.has("ArrowUp") || keys.current.has("w")),
        jump: keys.current.has(" "),
        sprinting: false,
      }),
      underlay: (frame, h) => {
        const scale = h.camera.scale;
        const a = h.camera.worldToScreen(-256, -144);
        frame.rect(a.sx, a.sy, 480 * scale, 288 * scale, "#edf1e8", "#7f928d");
        for (let x = -256; x <= 224; x += 16) {
          const p = h.camera.worldToScreen(x, -144),
            q = h.camera.worldToScreen(x, 144);
          frame.line(p.sx, p.sy, q.sx, q.sy, "#d6ded5");
        }
        for (let y = -144; y <= 144; y += 16) {
          const p = h.camera.worldToScreen(-256, y),
            q = h.camera.worldToScreen(224, y);
          frame.line(p.sx, p.sy, q.sx, q.sy, "#d6ded5");
        }
        const path = h.camera.worldToScreen(48, -144);
        if (settings.current.visibility !== "upper")
          frame.rect(path.sx, path.sy, 64 * scale, 288 * scale, "#bfcabd");
      },
      overlay: (frame) => {
        frame.label("RAMP → DECK", 35, 38, "#253b42", "bold 16px sans-serif");
        frame.label("Passage below runs north / south", 35, 62, "#435a60", "14px sans-serif");
      },
      onFrame: (h) => {
        const player = h.session.view.playerEntity;
        c.dataset.playerX = String(player.position.wx);
        c.dataset.playerY = String(player.position.wy);
        c.dataset.playerZ = String(player.wz ?? 0);
        c.dataset.serverZ = String(h.session.view.serverPlayerEntity.wz ?? 0);
        c.dataset.support = describeSurfaceSupport(h.session.view.props, player);
        c.dataset.visibility = settings.current.visibility;
        const next = `Height ${(player.wz ?? 0).toFixed(1)} · ${c.dataset.support} · ${settings.current.visibility} view`;
        if (next !== lastStatus && alive) {
          lastStatus = next;
          setStatus(next);
        }
      },
      onError: (e) => {
        delete c.dataset.ready;
        if (alive) setError(String(e));
      },
    });
    scene.current = host;
    void host.ready
      .then(() => {
        if (alive) c.dataset.ready = "true";
      })
      .catch((e) => {
        if (alive) setError(String(e));
      });
    const release = () => keys.current.clear();
    window.addEventListener("blur", release);
    return () => {
      alive = false;
      delete c.dataset.ready;
      host.dispose();
      scene.current = null;
      keys.current.clear();
      window.removeEventListener("blur", release);
    };
  }, [restart]);
  const touch = (key: string) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      // Keep a held control from starting selection or stealing canvas focus.
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      keys.current.add(key);
    },
    onPointerUp: () => keys.current.delete(key),
    onPointerCancel: () => keys.current.delete(key),
    onLostPointerCapture: () => keys.current.delete(key),
  });
  return (
    <section>
      <p className="eyebrow">ENGINE PROOF / SCHEMATIC GEOMETRY</p>
      <h1>World geometry lab</h1>
      <p>
        Walk up the ramp, cross the deck, or pass underneath. Jump beneath the deck to test its
        ceiling; walk off an edge to fall. Arrows/WASD move; Space jumps.
      </p>
      <p>
        Automatic cutaway reveals the space you occupy. View selection changes drawing only. This is
        diagnostic geometry, not finished building artwork.
      </p>
      <div className="actions geometry-controls">
        {Object.entries(GEOMETRY_STARTS).map(([name, start]) => (
          <button
            onContextMenu={(e) => e.preventDefault()}
            type="button"
            key={name}
            onClick={() => {
              keys.current.clear();
              void scene.current
                ?.command({ kind: "teleport", ...start })
                .catch((e) => setError(String(e)));
              canvas.current?.focus();
            }}
          >
            Start at {name}
          </button>
        ))}
        <button
          onContextMenu={(e) => e.preventDefault()}
          type="button"
          onClick={() => setPaused(!paused)}
        >
          {paused ? "Resume" : "Pause"}
        </button>
        <button
          onContextMenu={(e) => e.preventDefault()}
          type="button"
          onClick={() => {
            setPaused(false);
            setRestart(restart + 1);
          }}
        >
          Reset scene
        </button>
        <button
          onContextMenu={(e) => e.preventDefault()}
          type="button"
          onClick={() => {
            void scene.current?.session.reload().catch((e) => setError(String(e)));
          }}
        >
          Save / reload scene
        </button>
      </div>
      <label>
        Visible surfaces{" "}
        <select
          aria-label="Visible surfaces"
          value={visibility}
          onChange={(e) => setVisibility(e.target.value as SurfaceVisibility)}
        >
          <option value="auto">Automatic cutaway</option>
          <option value="all">All surfaces</option>
          <option value="lower">Lower passage</option>
          <option value="upper">Upper deck + ramp</option>
        </select>
      </label>
      <p role="status">{status}</p>
      {error ? <p role="alert">{error}</p> : null}
      <div style={{ position: "relative", maxWidth: 960, overflow: "hidden", borderRadius: 12 }}>
        <canvas
          key={restart}
          ref={canvas}
          width={960}
          height={640}
          aria-label="World geometry scene"
          tabIndex={0}
          style={{ display: "block", width: "100%", touchAction: "none" }}
          onKeyDown={(e) => {
            if (
              ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "a", "s", "d", " "].includes(
                e.key,
              )
            ) {
              e.preventDefault();
              keys.current.add(e.key);
            }
          }}
          onKeyUp={(e) => keys.current.delete(e.key)}
          onBlur={() => keys.current.clear()}
        />
      </div>
      <fieldset className="actions geometry-controls" aria-label="Movement controls">
        {[
          ["←", "ArrowLeft"],
          ["↑", "ArrowUp"],
          ["↓", "ArrowDown"],
          ["→", "ArrowRight"],
          ["Jump", " "],
        ].map(([label, key]) => (
          <button
            onContextMenu={(e) => e.preventDefault()}
            type="button"
            key={key}
            {...touch(key ?? "")}
          >
            {label}
          </button>
        ))}
      </fieldset>
    </section>
  );
}
