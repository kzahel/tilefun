import { useEffect, useMemo, useRef, useState } from "react";
import { AudioManager } from "../audio/AudioManager.js";
import type { LabDiagnostics } from "../client/LabScene.js";
import { LabView } from "../client/LabView.js";
import type { RecipeWorldClient } from "../client/RecipeWorldClient.js";
import type { SurfaceVisibility } from "../rendering/SurfacePresentation.js";
import {
  GENERATED_CROSSINGS,
  generatedCrossingRecipe,
} from "../scenarios/GeneratedCrossingRecipe.js";
import { JUMP_STARTS, type JumpLane } from "../scenarios/JumpParkRecipe.js";
import { DYNAMICS_STARTS } from "../scenarios/VehicleDynamicsRecipe.js";
import { fixedCamera } from "../session/View.js";
import { required } from "../shared/required.js";
import { VEHICLE_MODELS } from "../traffic/Vehicle.js";
import { RACE_MODELS } from "../traffic/VehiclePerformance.js";
import { occupiedVehicle } from "../traffic/VehicleSeats.js";
import DeferredVehiclePage from "./DeferredVehiclePage.js";
import { recordGeometryFrame } from "./GeometryFrame.js";
import NaturalLandscapePage from "./NaturalLandscapePage.js";
import { TRAFFIC_FIXTURES } from "./TrafficFixtures.js";
import {
  GeometryIntro,
  geometryRecipe,
  geometryStarts,
  geometryView,
} from "./WorldGeometryFixtures.js";

export type GeometryCanvas = HTMLCanvasElement & {
  __physicsSample?: RecipeWorldClient["samplePhysicsDiagnostics"];
  __presentationDiagnostics?: () => LabDiagnostics;
  __command?: LabView["command"]; // Exact placement for browser checks.
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
  "outskirts-park",
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
    !GENERATED_CROSSINGS.some((c) => initial === `generated-${c.key}`)
  )
    return <DeferredVehiclePage />;
  return <GeometryFixtures initial={initial} />;
}
function GeometryFixtures({ initial }: { initial: string }) {
  const canvas = useRef<GeometryCanvas>(null),
    scene = useRef<LabView | null>(null);
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
  const [reverse, setReverse] = useState(false),
    [paused, setPaused] = useState(false);
  const [visibility, setVisibility] = useState<SurfaceVisibility>("auto");
  const [status, setStatus] = useState("Loading scene…"),
    [error, setError] = useState("");
  const settings = useRef({ paused, visibility, sounds });
  settings.current = { paused, visibility, sounds };
  const vehicle = fixture.startsWith("car-");
  const generatedIndex = GENERATED_CROSSINGS.findIndex((c) => fixture === `generated-${c.key}`);
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
    setError("");
    setPaused(false);
    const view = geometryView({ fixture, generated, ambient });
    // The game's lab view: player follow, or a fixed diagnostic frame.
    const lab = new LabView(c, recipe, {
      width: 960,
      height: 640,
      terrain: view.terrain,
      ...(view.camera ? { camera: fixedCamera(view.camera) } : {}),
      surfaceVisibility: () => settings.current.visibility,
      settings: () => ({
        paused: settings.current.paused,
        zoom: view.zoom,
        terrainPacing: "throughput",
      }),
      onFrame: ({ client }) => {
        const p = client.replica.playerEntity;
        audio.current?.updateCarEngine(
          occupiedVehicle(p, client.replica.entities),
          settings.current.sounds &&
            !settings.current.paused &&
            !document.hidden &&
            audioFocused.current,
        );
        recordGeometryFrame(c.dataset, client, {
          visibility: settings.current.visibility,
          courseRoute: fixture === "car-dynamics" ? route : jumps ? lane : "",
          generated: generated && {
            seed: generated.recipe.generation.seed,
            bridge: generated.bridge,
          },
        });
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
    scene.current = lab;
    c.__physicsSample = (reset) => lab.client.samplePhysicsDiagnostics(reset);
    c.__presentationDiagnostics = () => lab.getDiagnostics();
    c.__command = (command) => lab.command(command);
    void lab.ready
      .then(async () => {
        // The jump park seats the driver at each lane's start line.
        const car = lab.client.handles.car;
        if (alive && jumps && car !== undefined)
          await lab.command({ kind: "enter-vehicle", entityId: car });
        if (alive) c.dataset.ready = "true";
      })
      .catch((reason) => {
        if (alive) setError(String(reason));
      });
    const release = () => {
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
      delete c.__command;
      lab.dispose();
      scene.current = null;
      audio.current?.stopCarEngine();
      window.removeEventListener("blur", release);
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", visibilityChange);
    };
  }, [recipe, restart, generated, fixture, vehicle]);
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
            <option key={c.key} value={`generated-${c.key}`}>
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
            void scene.current
              ?.reload()
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
        />
      </div>
    </section>
  );
}
