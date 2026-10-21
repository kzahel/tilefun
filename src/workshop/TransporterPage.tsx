import { useEffect, useRef, useState } from "react";
import type { RendererMode } from "../rendering/RenderHost.js";
import { ScenarioPresentationHost } from "../scenarios/ScenarioPresentationHost.js";
import { transporterRecipe } from "../scenarios/TransporterRecipe.js";
import { vehicleNoseHeading } from "../traffic/Vehicle.js";

export type TransporterCanvas = HTMLCanvasElement & {
  __transporterDiagnostics?: () => ReturnType<ScenarioPresentationHost["getDiagnostics"]> & {
    player: { wx: number; wy: number; parent: number | null };
    truck: {
      id: number;
      wx: number;
      wy: number;
      heading: number;
      z: number;
      ramp: boolean;
      target: number | null;
    } | null;
    car: {
      id: number;
      wx: number;
      wy: number;
      heading: number;
      z: number;
      owner: number | null;
    } | null;
  };
  __captureTransporter?: () => HTMLCanvasElement;
};
export default function TransporterPage() {
  const canvas = useRef<TransporterCanvas>(null),
    host = useRef<ScenarioPresentationHost | null>(null),
    keys = useRef(new Set<string>());
  const [paused, setPaused] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [renderer, setRenderer] = useState<RendererMode>("gpu-mesh");
  const settings = useRef({ paused });
  settings.current = { paused };
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    let live = true;
    const h = new ScenarioPresentationHost(c, transporterRecipe(), {
      onError: (e) => setError(String(e)),
      width: 768,
      height: 512,
      terrain: true,
      defaultRenderer: "gpu-mesh",
      background: "#88a77b",
      settings: () => ({
        paused: settings.current.paused,
        zoom: 0.75,
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
        reversing: keys.current.has("r"),
      }),
      fixedCamera: () => {
        const truck = h.session.view.entities.find((e) => e.type === "vehicle-v1:car-transporter");
        const p = truck?.position ?? { wx: 0, wy: 0 },
          heading = truck ? vehicleNoseHeading(truck) : 0;
        return { wx: p.wx - 82 * Math.cos(heading), wy: p.wy - 82 * Math.sin(heading) - 20 };
      },
    });
    host.current = h;
    c.__transporterDiagnostics = () => {
      const entities = h.session.view.entities,
        truck = entities.find((e) => e.type === "vehicle-v1:car-transporter"),
        car = entities.find((e) => e.type === "vehicle-v1:beetle");
      return {
        ...h.getDiagnostics(),
        player: {
          ...h.session.view.playerEntity.position,
          parent: h.session.view.playerEntity.parentId ?? null,
        },
        truck: truck
          ? {
              id: truck.id,
              ...{ wx: truck.position.wx, wy: truck.position.wy },
              heading: vehicleNoseHeading(truck),
              z: truck.wz ?? 0,
              ramp: truck.vehicleRamp === 1,
              target: truck.transportLoadId ?? null,
            }
          : null,
        car: car
          ? {
              id: car.id,
              wx: car.position.wx,
              wy: car.position.wy,
              heading: vehicleNoseHeading(car),
              z: car.wz ?? 0,
              owner: car.transportedBy ?? null,
            }
          : null,
      };
    };
    c.__captureTransporter = () => h.captureFrame();
    void h.ready
      .then(() => {
        if (live) c.dataset.ready = "true";
      })
      .catch((e) => {
        if (live) setError(String(e));
      });
    const clear = () => keys.current.clear();
    window.addEventListener("blur", clear);
    return () => {
      live = false;
      clear();
      h.dispose();
      host.current = null;
      delete c.__transporterDiagnostics;
      delete c.__captureTransporter;
      window.removeEventListener("blur", clear);
    };
  }, []);
  const run = async (op: (h: ScenarioPresentationHost) => Promise<unknown>) => {
    const h = host.current;
    if (!h || busy) return;
    keys.current.clear();
    setBusy(true);
    setError("");
    try {
      await op(h);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
      canvas.current?.focus();
    }
  };
  return (
    <section>
      <h1>Car transporter playground</h1>
      <p>
        Deploy the ramp, drive the Beetle onto the deck, get out and secure it. Stow the ramp before
        driving the truck. Deploy and release to reverse the car off. WASD / arrows steer; E
        enters/exits, Q opens Actions. Controller: left stick, Y and B.
      </p>
      <div className="actions">
        <button
          type="button"
          onClick={() => {
            keys.current.clear();
            setPaused(!paused);
          }}
        >
          {paused ? "Resume" : "Pause"}
        </button>
        <button type="button" disabled={!paused || busy} onClick={() => void run((h) => h.step())}>
          Step
        </button>
        <button type="button" disabled={busy} onClick={() => void run((h) => h.session.reload())}>
          Reload
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void run((h) => h.session.reload(true))}
        >
          Reset
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            void run((h) => {
              const car = h.session.view.entities.find((e) => e.type === "vehicle-v1:beetle");
              return car
                ? h.command({
                    kind: "teleport",
                    position: { wx: car.position.wx, wy: car.position.wy + 40 },
                  })
                : Promise.resolve();
            })
          }
        >
          Stand beside car
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            void run((h) => {
              const truck = h.session.view.entities.find(
                (e) => e.type === "vehicle-v1:car-transporter",
              );
              if (!truck) return Promise.resolve();
              return h.session.command({
                kind: "teleport",
                position: { wx: truck.position.wx + 12, wy: truck.position.wy + 44 },
              });
            })
          }
        >
          Stand beside truck
        </button>
        <label>
          Renderer{" "}
          <select
            aria-label="Transporter renderer"
            value={renderer}
            disabled={busy}
            onChange={(e) => {
              const mode = e.target.value as RendererMode;
              void run(async (h) => setRenderer(await h.selectRenderer(mode)));
            }}
          >
            <option value="gpu-mesh">3D vehicles</option>
            <option value="canvas">Canvas sprites</option>
            <option value="gpu">GPU sprites</option>
          </select>
        </label>
      </div>
      {error && <p role="alert">{error}</p>}
      <div style={{ position: "relative", width: 768, maxWidth: "100%" }}>
        <canvas
          ref={canvas}
          width={768}
          height={512}
          tabIndex={0}
          aria-label="Transporter scene"
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
    </section>
  );
}
