import { useEffect, useMemo, useRef, useState } from "react";
import { AudioManager } from "../audio/AudioManager.js";
import { rotateBodyVector } from "../physics/BodyRotation.js";
import { locateSurfaceSpace } from "../physics/TerrainExcavation.js";
import {
  describeSurfaceSupport,
  type SurfaceVisibility,
} from "../rendering/SurfacePresentation.js";
import {
  GENERATED_CROSSINGS,
  generatedCrossingRecipe,
} from "../scenarios/GeneratedCrossingRecipe.js";
import { JUMP_STARTS, type JumpLane } from "../scenarios/JumpParkRecipe.js";
import { ScenarioPresentationHost } from "../scenarios/ScenarioPresentationHost.js";
import { TREE_HOUSE_AT } from "../scenarios/TreeHouseRecipe.js";
import { DYNAMICS_STARTS } from "../scenarios/VehicleDynamicsRecipe.js";
import { required } from "../shared/required.js";
import { VEHICLE_MODELS } from "../traffic/Vehicle.js";
import { RACE_MODELS } from "../traffic/VehiclePerformance.js";
import { occupiedVehicle } from "../traffic/VehicleSeats.js";
import DeferredVehiclePage from "./DeferredVehiclePage.js";
import { recordEquipment } from "./EquipmentDiagnostics.js";
import NaturalLandscapePage from "./NaturalLandscapePage.js";
import { TRAFFIC_FIXTURES } from "./TrafficFixtures.js";
import { GeometryIntro, geometryRecipe, geometryStarts } from "./WorldGeometryFixtures.js";

export type GeometryCanvas = HTMLCanvasElement & {
  __physicsSample?: ScenarioPresentationHost["session"]["samplePhysicsDiagnostics"];
  __presentationDiagnostics?: () => ReturnType<ScenarioPresentationHost["getDiagnostics"]>;
  __command?: ScenarioPresentationHost["command"]; // Exact placement for browser checks.
};
const FIXTURES = [
  "deck",
  "garage",
  "crossing",
  "car-bridge",
  "car-garage",
  "car-dynamics",
  "car-jumps",
  "tree-house",
  "realm",
  "traffic",
  "traffic-crowd",
  "racetrack",
  "shopping",
  "train",
];
export default function WorldGeometryPage({
  defaultFixture = "deck",
}: {
  defaultFixture?: string;
}) {
  const initial = new URLSearchParams(location.search).get("geometry") ?? defaultFixture;
  if (initial.startsWith("nature-")) return <NaturalLandscapePage />;
  if (
    !FIXTURES.includes(initial) &&
    !GENERATED_CROSSINGS.some((c) => initial === `generated-${c.seed}`)
  )
    return <DeferredVehiclePage />;
  return <GeometryFixtures initial={initial} />;
}
function GeometryFixtures({ initial }: { initial: string }) {
  const canvas = useRef<GeometryCanvas>(null),
    scene = useRef<ScenarioPresentationHost | null>(null);
  const keys = useRef(new Set<string>());
  const audio = useRef<AudioManager | null>(null),
    audioFocused = useRef(true);
  const [sounds, setSounds] = useState(false);
  useEffect(() => () => audio.current?.dispose(), []);
  const [fixture, setFixture] = useState(initial),
    [restart, setRestart] = useState(0);
  const [vehicleModel, setVehicleModel] = useState(() => {
    const fallback = initial === "car-jumps" ? "rally-hatchback" : "compact-1";
    const model = new URLSearchParams(location.search).get("vehicle") ?? fallback;
    return VEHICLE_MODELS.includes(model) ? model : fallback;
  });
  const [route, setRoute] = useState<keyof typeof DYNAMICS_STARTS>(() => {
    const route = new URLSearchParams(location.search).get("route");
    return (
      (Object.keys(DYNAMICS_STARTS).find((key) => key === route) as
        | keyof typeof DYNAMICS_STARTS
        | undefined) ?? "drive"
    );
  });
  const [lane, setLane] = useState<JumpLane>(() => {
    const lane = new URLSearchParams(location.search).get("lane");
    return (
      (Object.keys(JUMP_STARTS).find((key) => key === lane) as JumpLane | undefined) ?? "kicker"
    );
  });
  const jumps = fixture === "car-jumps";
  const treeHouse = fixture === "tree-house";
  const [reverse, setReverse] = useState(false),
    [paused, setPaused] = useState(false);
  const [visibility, setVisibility] = useState<SurfaceVisibility>("auto");
  const [status, setStatus] = useState("Loading scene…"),
    [error, setError] = useState("");
  const settings = useRef({ paused, visibility, sounds });
  settings.current = { paused, visibility, sounds };
  const vehicle = fixture.startsWith("car-");
  const generatedIndex = GENERATED_CROSSINGS.findIndex((c) => fixture === `generated-${c.seed}`);
  const generated = useMemo(
    () => (generatedIndex < 0 ? undefined : generatedCrossingRecipe(generatedIndex, reverse)),
    [generatedIndex, reverse],
  );
  const ambient = TRAFFIC_FIXTURES[fixture];
  const recipe = useMemo(
    () => geometryRecipe({ fixture, generated, ambient, vehicleModel, route, lane, reverse }),
    [generated, fixture, reverse, vehicleModel, route, lane, ambient],
  );
  const starts = geometryStarts({ fixture, generated, ambient }, recipe);
  // biome-ignore lint/correctness/useExhaustiveDependencies: restart deliberately replaces the Worker and canvas.
  useEffect(() => {
    const c = required(canvas.current);
    let alive = true,
      lastStatus = "";
    keys.current.clear();
    setError("");
    setPaused(false);
    const host = new ScenarioPresentationHost(c, recipe, {
      width: 960,
      height: 640,
      terrain:
        !!generated ||
        fixture === "realm" ||
        fixture === "traffic" ||
        fixture === "traffic-crowd" ||
        !!ambient ||
        fixture === "train" ||
        fixture === "car-dynamics" ||
        jumps ||
        treeHouse,
      ...(vehicle || fixture === "realm" || fixture === "train"
        ? {}
        : {
            fixedCamera: generated
              ? { wx: generated.bridge.x * 16, wy: generated.bridge.y * 16 - 16 }
              : treeHouse
                ? { wx: TREE_HOUSE_AT.wx, wy: TREE_HOUSE_AT.wy - 72 }
                : (ambient?.camera ?? { wx: 0, wy: -16 }),
          }),
      surfaceVisibility: () => settings.current.visibility,
      settings: () => ({
        paused: settings.current.paused,
        zoom:
          ambient?.zoom ??
          (fixture === "traffic-crowd"
            ? 0.125
            : jumps
              ? 0.25
              : treeHouse
                ? 1
                : fixture === "car-dynamics" || fixture === "train"
                  ? 0.4
                  : generated || fixture === "crossing" || fixture === "traffic"
                    ? 0.225
                    : 0.625),
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
        sprinting: keys.current.has("Shift"),
        reversing: keys.current.has("r"),
      }),
      onFrame: (h) => {
        const p = h.session.view.playerEntity,
          server = h.session.view.serverPlayerEntity;
        audio.current?.updateCarEngine(
          occupiedVehicle(p, h.session.view.entities),
          settings.current.sounds &&
            !settings.current.paused &&
            !document.hidden &&
            audioFocused.current,
        );
        c.dataset.playerX = String(p.position.wx);
        c.dataset.playerY = String(p.position.wy);
        c.dataset.playerZ = String(p.wz ?? 0);
        c.dataset.serverZ = String(server.wz ?? 0);
        c.dataset.support = describeSurfaceSupport(h.session.view.props, p);
        c.dataset.space = locateSurfaceSpace(h.session.view.props, p);
        c.dataset.serverSpace = locateSurfaceSpace(h.session.view.props, server);
        c.dataset.visibility = settings.current.visibility;
        c.dataset.courseRoute = fixture === "car-dynamics" ? route : jumps ? lane : "";
        c.dataset.generatedSeed = generated ? String(generated.recipe.generation.seed) : "";
        c.dataset.bridgeX = String((generated?.bridge.x ?? 0) * 16);
        c.dataset.bridgeY = String((generated?.bridge.y ?? 0) * 16);
        c.dataset.surfaceCount = String(
          h.session.view.props.filter((p) => p.collider?.surface).length,
        );
        const car =
          h.session.view.entities.find((e) => e.id === h.session.handles.car) ??
          h.session.view.entities.find((e) => e.type.startsWith("vehicle-v1:"));
        if (car) {
          c.dataset.carX = String(car.position.wx);
          c.dataset.carY = String(car.position.wy);
          c.dataset.carZ = String(car.wz ?? 0);
          c.dataset.carModel = car.type.slice(11);
          c.dataset.carUp = String(
            car.bodyRotation ? rotateBodyVector(car.bodyRotation, 0, 0, 1).z : 1,
          );
          c.dataset.carRotation = JSON.stringify(car.bodyRotation ?? null);
        }
        recordEquipment(c.dataset, h.session.view.entities, h.session.handles);
        const traffic = h.session.view.entities.filter(
          (e) => e.type.startsWith("vehicle-v1:") && e.id !== h.session.handles.car,
        );
        c.dataset.trafficCount = String(traffic.length);
        const sample = traffic[0];
        if (sample) {
          c.dataset.trafficX = String(sample.position.wx);
          c.dataset.trafficY = String(sample.position.wy);
        }
        const next = `Height ${(p.wz ?? 0).toFixed(1)} · ${c.dataset.support} · space ${c.dataset.space}`;
        if (next !== lastStatus && alive) {
          lastStatus = next;
          setStatus(next);
        }
      },
      onError: (reason) => {
        audio.current?.stopCarEngine();
        delete c.dataset.ready;
        if (alive) setError(String(reason));
      },
    });
    scene.current = host;
    c.__physicsSample = (reset) => host.session.samplePhysicsDiagnostics(reset);
    c.__presentationDiagnostics = () => host.getDiagnostics();
    c.__command = (command) => host.command(command);
    void host.ready
      .then(async () => {
        // The jump park seats the driver at each lane's start line.
        const car = host.session.handles.car;
        if (alive && jumps && car !== undefined)
          await host.command({ kind: "enter-vehicle", entityId: car });
        if (alive) c.dataset.ready = "true";
      })
      .catch((reason) => {
        if (alive) setError(String(reason));
      });
    const release = () => {
      keys.current.clear();
      audioFocused.current = false;
      audio.current?.stopCarEngine();
    };
    const focus = () => {
      audioFocused.current = true;
    };
    const visibilityChange = () => {
      if (document.hidden) release();
      else focus();
    };
    window.addEventListener("blur", release);
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", visibilityChange);
    return () => {
      alive = false;
      delete c.dataset.ready;
      delete c.__physicsSample;
      delete c.__presentationDiagnostics;
      host.dispose();
      scene.current = null;
      keys.current.clear();
      audio.current?.stopCarEngine();
      window.removeEventListener("blur", release);
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", visibilityChange);
    };
  }, [recipe, restart, generated, fixture, vehicle]);
  const touch = (key: string) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
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
      <p className="eyebrow">SHARED GAME PHYSICS</p>
      <GeometryIntro fixture={fixture} />
      <label>
        Fixture{" "}
        <select
          aria-label="Geometry fixture"
          value={fixture}
          onChange={(e) => setFixture(e.target.value)}
        >
          {FIXTURES.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
          {GENERATED_CROSSINGS.map((c) => (
            <option key={c.seed} value={`generated-${c.seed}`}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      {vehicle && (
        <label>
          Vehicle{" "}
          <select
            aria-label="Vehicle model"
            value={vehicleModel}
            onChange={(e) => setVehicleModel(e.target.value)}
          >
            {(jumps
              ? [...RACE_MODELS, ...VEHICLE_MODELS.filter((m) => !RACE_MODELS.includes(m))]
              : VEHICLE_MODELS
            ).map((m) => (
              <option key={m} value={m}>
                {RACE_MODELS.includes(m) ? `${m} (race tune)` : m}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="actions">
        <button
          type="button"
          aria-pressed={sounds}
          onClick={() => {
            audio.current ??= new AudioManager();
            if (!sounds) audio.current.tryResume();
            else audio.current.stopCarEngine();
            setSounds(!sounds);
          }}
        >
          {sounds ? "Mute engine sounds" : "Enable engine sounds"}
        </button>
        {Object.entries(starts).map(([name, start]) => (
          <button
            key={name}
            type="button"
            onClick={() => {
              if (fixture === "car-dynamics") {
                setRoute(name as keyof typeof DYNAMICS_STARTS);
                setRestart((n) => n + 1);
                return;
              }
              if (jumps) {
                setLane(name as JumpLane);
                setRestart((n) => n + 1);
                return;
              }
              void scene.current
                ?.command({ kind: "teleport", ...start })
                .catch((e) => setError(String(e)));
              canvas.current?.focus();
            }}
          >
            {name}
          </button>
        ))}
        {vehicle && fixture !== "car-dynamics" && !jumps && (
          <button type="button" onClick={() => setReverse(!reverse)}>
            Opposite direction
          </button>
        )}
        <button type="button" onClick={() => setPaused(!paused)}>
          {paused ? "Resume" : "Pause"}
        </button>
        <button type="button" onClick={() => setRestart(restart + 1)}>
          Reset scene
        </button>
        <button
          type="button"
          onClick={() => {
            void scene.current?.session
              .reload()
              .then(() => {
                const c = canvas.current;
                if (c) c.dataset.reloadCount = String(Number(c.dataset.reloadCount ?? 0) + 1);
              })
              .catch((e) => setError(String(e)));
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
          <option value="upper">Upper deck</option>
        </select>
      </label>
      <p role="status">{status}</p>
      {error && <p role="alert">{error}</p>}
      <div style={{ position: "relative", maxWidth: 960, overflow: "hidden", borderRadius: 12 }}>
        <canvas
          key={`${fixture}-${restart}-${reverse}-${vehicleModel}`}
          ref={canvas}
          width={960}
          height={640}
          aria-label="World geometry scene"
          tabIndex={0}
          style={{ display: "block", width: "100%", touchAction: "none" }}
          onKeyDown={(e) => {
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
                "r",
                "Shift",
              ].includes(e.key)
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
          ["Boost", "Shift"],
        ].map(([label, key]) => (
          <button
            key={key}
            type="button"
            onContextMenu={(e) => e.preventDefault()}
            {...touch(key ?? "")}
          >
            {label}
          </button>
        ))}
      </fieldset>
    </section>
  );
}
