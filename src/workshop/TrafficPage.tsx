import { useCallback, useEffect, useRef, useState } from "react";
import { required } from "../art/ArtCatalog.js";
import { AudioManager } from "../audio/AudioManager.js";
import {
  TERRAIN_PACING,
  type TerrainPacing,
  ZOOM_PRESETS,
} from "../rendering/PresentationSettings.js";
import type { TerrainDiagnostics } from "../rendering/RenderFrame.js";
import { ScenarioPresentationHost } from "../scenarios/ScenarioPresentationHost.js";
import { TRAFFIC_DEMO_GENERATION, trafficRecipe } from "../scenarios/TrafficRecipe.js";
import { carDrivingStyle } from "../traffic/CarControls.js";
import {
  hasVehicleLights,
  isEmergencyVehicle,
  isWarningVehicle,
  vehicleLightState,
} from "../traffic/EmergencyVehicle.js";
import { ORIGINAL_VEHICLES } from "../traffic/OriginalVehicles.js";
import { vehicleNoseHeading } from "../traffic/Vehicle.js";
import { vehiclePaintSchemes } from "../traffic/VehiclePaint.js";

export type TrafficCanvas = HTMLCanvasElement & {
  /** Read-only, on-demand diagnostics for lab profiling and integration checks. */
  __terrainDiagnostics?: () => TerrainDiagnostics | undefined;
  __presentationDiagnostics?: () => ReturnType<ScenarioPresentationHost["getDiagnostics"]>;
};

export default function TrafficPage() {
  const canvas = useRef<TrafficCanvas>(null),
    scene = useRef<ScenarioPresentationHost | null>(null),
    keys = useRef(new Set<string>());
  const audio = useRef<AudioManager | null>(null);
  const hornState = useRef({ active: false, refreshed: 0 });
  const [error, setError] = useState(""),
    [restart, setRestart] = useState(0),
    [paused, setPaused] = useState(false);
  const honk = useCallback((active: boolean) => {
    audio.current ??= new AudioManager();
    if (active) audio.current.tryResume();
    hornState.current = { active, refreshed: performance.now() };
    void scene.current?.command({ kind: "vehicle-horn", active }).catch((e) => setError(String(e)));
  }, []);
  const [model, setModel] = useState("compact-1");
  const [paint, setPaint] = useState("");
  const carStyle = useRef("direction");
  const [driving, setDriving] = useState(false);
  const [emergencyState, setEmergencyState] = useState(2);
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
    const host = new ScenarioPresentationHost(c, trafficRecipe(model, paint || undefined), {
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
          sprinting: k.has("Shift"),
          reversing: k.has("r"),
          relativeDriving:
            carStyle.current === "steering" &&
            scene.current?.session.view.playerEntity.parentId !== undefined,
        };
      },
      onError: (e) => {
        delete c.dataset.ready;
        if (alive) setError(String(e));
      },
      onFrame: (h) => {
        const s = h.session;
        const car = s.view.entities.find((e) => e.id === s.handles.car) ?? s.view.playerEntity;
        const occupied = s.view.playerEntity.parentId === car.id;
        const horn =
          occupied && !presentation.current.paused && !document.hidden && keys.current.has("h");
        if (
          horn !== hornState.current.active ||
          (horn && performance.now() - hornState.current.refreshed >= 200)
        )
          honk(horn);
        if (presentation.current.paused || document.hidden) audio.current?.stopHorns();
        setDriving(occupied);
        setEmergencyState(vehicleLightState(car));
        c.dataset.emergencyState = String(vehicleLightState(car));
        c.dataset.driving = String(occupied);
        c.dataset.playerZ = String(s.view.playerEntity.wz ?? 0);
        c.dataset.carX = String(car.position.wx);
        c.dataset.carY = String(car.position.wy);
        c.dataset.carHeading = String(vehicleNoseHeading(car));
        c.dataset.paintScheme = car.paintSchemeId ?? "original";
        c.dataset.carSheet = car.sprite?.sheetKey ?? "";
        c.dataset.speed = String(
          occupied
            ? Math.hypot(car.velocity?.vx ?? 0, car.velocity?.vy ?? 0)
            : (s.traffic?.speed ?? 0),
        );
        c.dataset.waiting = s.traffic?.waiting ?? "";
        c.dataset.cars = String(
          s.view.entities.filter((e) => e.type.startsWith("vehicle-v1:")).length,
        );
        c.dataset.playerX = String(s.view.playerEntity.position.wx);
        c.dataset.playerY = String(s.view.playerEntity.position.wy);
      },
    });
    host.session.onHorn = (message) => {
      if (presentation.current.paused || document.hidden) return;
      audio.current?.playVehicleHorn(message, host.session.view.playerEntity.position);
    };
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
    const release = () => {
      keys.current.clear();
      honk(false);
      audio.current?.stopHorns();
    };
    window.addEventListener("blur", release);
    const visibility = () => {
      if (document.hidden) release();
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      alive = false;
      delete c.__terrainDiagnostics;
      delete c.dataset.ready;
      delete c.__presentationDiagnostics;
      audio.current?.stopHorns();
      hornState.current = { active: false, refreshed: 0 };
      host.dispose();
      window.removeEventListener("blur", release);
      document.removeEventListener("visibilitychange", visibility);
      keys.current.clear();
      scene.current = null;
    };
  }, [restart, model, paint, honk]);
  const touch = (key: string) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      keys.current.add(key);
      if (key === "h") honk(true);
    },
    onPointerUp: () => {
      keys.current.delete(key);
      if (key === "h") honk(false);
    },
    onPointerCancel: () => {
      keys.current.delete(key);
      if (key === "h") honk(false);
    },
    onLostPointerCapture: () => {
      keys.current.delete(key);
      if (key === "h") honk(false);
    },
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
        <label>
          Vehicle{" "}
          <select
            aria-label="Playground vehicle"
            value={model}
            onChange={(e) => {
              setPaint("");
              setModel(e.target.value);
            }}
          >
            <option value="compact-1">Blue car</option>
            {ORIGINAL_VEHICLES.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.name}
              </option>
            ))}
            <option value="compact-2">Green car</option>
            <option value="compact-3">Cyan car</option>
            <option value="compact-4">Red car</option>
            <option value="compact-5">Orange car</option>
            <option value="compact-6">Silver car</option>
            <option value="unindexed-sedan-red">Red sedan</option>
            <option value="unindexed-sedan-beige">Beige sedan</option>
            <option value="unindexed-sedan-cyan">Cyan sedan</option>
            <option value="unindexed-sedan-orange">Orange sedan</option>
            <option value="unindexed-sedan-silver">Silver sedan</option>
            <option value="unindexed-sedan-olive">Olive sedan</option>
            <option value="unindexed-sedan-dark">Dark sedan</option>
            <option value="car-7">Car 7</option>
            <option value="car-8">Car 8</option>
            <option value="car-9">Car 9</option>
            <option value="car-10">Car 10</option>
            <option value="car-11">Car 11</option>
            <option value="sedan-12">Beige sedan 12</option>
            <option value="car-13">Car 13</option>
            <option value="car-14">Car 14</option>
            <option value="car-15">Car 15</option>
            <option value="car-16">Car 16</option>
            <option value="car-17">Car 17</option>
            <option value="car-18">Car 18</option>
            <option value="car-19">Car 19</option>
            <option value="car-20">Car 20</option>
            <option value="car-21">Car 21</option>
            <option value="car-22">Car 22</option>
            <option value="car-23">Car 23</option>
            <option value="car-24">Car 24</option>
            <option value="car-25">Car 25</option>
            <option value="car-26">Car 26</option>
            <option value="bus-1">Bus 1</option>
            <option value="bus-2">Bus 2</option>
            <option value="bus-3">Bus 3</option>
            <option value="bus-4">Bus 4</option>
            <option value="bus-5">Bus 5</option>
            <option value="bus-6">Bus 6</option>
            <option value="police-car">Police car</option>
            <option value="garbage-truck-green">Green garbage truck</option>
            <option value="garbage-truck-orange">Orange garbage truck</option>
            <option value="fire-truck-ladder-2">Firetruck · raised ladder</option>
            <option value="ambulance">Ambulance</option>
            <option value="fire-truck-ladder-1">Firetruck</option>
          </select>
        </label>
        {vehiclePaintSchemes(model).length > 0 && (
          <label>
            Paint{" "}
            <select
              aria-label="Playground paint"
              value={paint}
              onChange={(e) => setPaint(e.target.value)}
            >
              <option value="">Original</option>
              {vehiclePaintSchemes(model).map((scheme) => (
                <option key={scheme.id} value={scheme.id}>
                  {scheme.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Car controls{" "}
          <select
            aria-label="Car controls"
            defaultValue="direction"
            onChange={(e) => {
              keys.current.clear();
              carStyle.current = carDrivingStyle(e.target.value);
            }}
          >
            <option value="direction">Point where to drive</option>
            <option value="steering">Forward / reverse and steer</option>
          </select>
        </label>
        {driving && (
          <button type="button" {...touch("Shift")}>
            Fast
          </button>
        )}
        {driving && (
          <button type="button" {...touch("h")} style={{ touchAction: "none" }}>
            Horn · H
          </button>
        )}
        {driving && hasVehicleLights({ type: `vehicle-v1:${model}` }) && (
          <>
            <button
              type="button"
              onClick={() => {
                void scene.current
                  ?.command({ kind: "vehicle-emergency", action: "toggle" })
                  .catch((e) => setError(String(e)));
              }}
            >
              {isWarningVehicle({ type: `vehicle-v1:${model}` }) ? "Beacon" : "Siren"}{" "}
              {emergencyState & 1 ? "On" : "Off"}
            </button>
            {isEmergencyVehicle({ type: `vehicle-v1:${model}` }) && (
              <button
                type="button"
                onClick={() => {
                  void scene.current
                    ?.command({ kind: "vehicle-emergency", action: "style" })
                    .catch((e) => setError(String(e)));
                }}
              >
                Style: {["Lights only", "EU two-tone", "US wail"][emergencyState >> 1]}
              </button>
            )}
          </>
        )}
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
            if (driving && e.key.toLowerCase() === "h") {
              e.preventDefault();
              if (!e.repeat) {
                keys.current.add("h");
                honk(true);
              }
              return;
            }
            const vehicle = { type: `vehicle-v1:${model}` };
            const lightAction =
              e.key.toLowerCase() === "l"
                ? "toggle"
                : e.key.toLowerCase() === "k" && isEmergencyVehicle(vehicle)
                  ? "style"
                  : undefined;
            if (driving && hasVehicleLights(vehicle) && lightAction) {
              e.preventDefault();
              if (!e.repeat)
                scene.current
                  ?.command({ kind: "vehicle-emergency", action: lightAction })
                  .catch((e) => setError(String(e)));
              return;
            }
            if (
              [
                "ArrowUp",
                "ArrowDown",
                "ArrowLeft",
                "ArrowRight",
                "w",
                "a",
                "s",
                "d",
                " ",
                "Shift",
                "r",
              ].includes(e.key)
            ) {
              keys.current.add(e.key);
              e.preventDefault();
            }
          }}
          onKeyUp={(e) => {
            keys.current.delete(e.key);
            if (e.key.toLowerCase() === "h") {
              keys.current.delete("h");
              honk(false);
            }
          }}
          onBlur={() => {
            keys.current.clear();
            honk(false);
          }}
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
