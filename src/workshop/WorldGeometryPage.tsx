import { useEffect, useMemo, useRef, useState } from "react";
import { required } from "../art/ArtCatalog.js";
import { locateSurfaceSpace } from "../physics/TerrainExcavation.js";
import {
  describeSurfaceSupport,
  type SurfaceVisibility,
} from "../rendering/SurfacePresentation.js";
import {
  GENERATED_CROSSINGS,
  generatedCrossingRecipe,
} from "../scenarios/GeneratedCrossingRecipe.js";
import { CROSSING_STARTS, railCrossingRecipe } from "../scenarios/RailCrossingRecipe.js";
import { realmPhysicsRecipe } from "../scenarios/RealmPhysicsRecipe.js";
import { ScenarioPresentationHost } from "../scenarios/ScenarioPresentationHost.js";
import { GARAGE_STARTS, undergroundGarageRecipe } from "../scenarios/UndergroundGarageRecipe.js";
import {
  VEHICLE_BRIDGE_STARTS,
  VEHICLE_GARAGE_STARTS,
  vehicleGeometryRecipe,
} from "../scenarios/VehicleGeometryRecipe.js";
import { GEOMETRY_STARTS, worldGeometryRecipe } from "../scenarios/WorldGeometryRecipe.js";
import { VEHICLE_MODELS } from "../traffic/Vehicle.js";
import DeferredVehiclePage from "./DeferredVehiclePage.js";
import NaturalLandscapePage from "./NaturalLandscapePage.js";

export type GeometryCanvas = HTMLCanvasElement & {
  __physicsSample?: (
    reset?: boolean,
  ) => Promise<import("../scenarios/ScenarioProtocol.js").ScenarioResponse["physicsDiagnostics"]>;
  __presentationDiagnostics?: () => ReturnType<ScenarioPresentationHost["getDiagnostics"]>;
};
const FIXTURES = ["deck", "garage", "crossing", "car-bridge", "car-garage", "realm"];
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
  const [fixture, setFixture] = useState(initial),
    [restart, setRestart] = useState(0);
  const [vehicleModel, setVehicleModel] = useState(() => {
    const model = new URLSearchParams(location.search).get("vehicle") ?? "compact-1";
    return VEHICLE_MODELS.includes(model) ? model : "compact-1";
  });
  const [reverse, setReverse] = useState(false),
    [paused, setPaused] = useState(false);
  const [visibility, setVisibility] = useState<SurfaceVisibility>("auto");
  const [status, setStatus] = useState("Loading scene…"),
    [error, setError] = useState("");
  const settings = useRef({ paused, visibility });
  settings.current = { paused, visibility };
  const garage = fixture === "garage" || fixture === "car-garage";
  const vehicle = fixture.startsWith("car-");
  const generatedIndex = GENERATED_CROSSINGS.findIndex((c) => fixture === `generated-${c.seed}`);
  const generated = useMemo(
    () => (generatedIndex < 0 ? undefined : generatedCrossingRecipe(generatedIndex, reverse)),
    [generatedIndex, reverse],
  );
  const recipe = useMemo(
    () =>
      generated?.recipe ??
      (fixture === "realm"
        ? realmPhysicsRecipe(
            new URLSearchParams(location.search).has("crowd")
              ? Number(new URLSearchParams(location.search).get("crowd"))
              : undefined,
          )
        : vehicle
          ? vehicleGeometryRecipe(garage, reverse, vehicleModel)
          : fixture === "crossing"
            ? railCrossingRecipe()
            : garage
              ? undergroundGarageRecipe()
              : worldGeometryRecipe()),
    [generated, fixture, garage, vehicle, reverse, vehicleModel],
  );
  const starts =
    generated?.starts ??
    (vehicle
      ? garage
        ? VEHICLE_GARAGE_STARTS
        : VEHICLE_BRIDGE_STARTS
      : garage
        ? GARAGE_STARTS
        : fixture === "crossing"
          ? CROSSING_STARTS
          : GEOMETRY_STARTS);
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
      terrain: !!generated || fixture === "realm",
      ...(vehicle || fixture === "realm"
        ? {}
        : {
            fixedCamera: generated
              ? { wx: generated.bridge.x * 16, wy: generated.bridge.y * 16 - 16 }
              : { wx: 0, wy: -16 },
          }),
      surfaceVisibility: () => settings.current.visibility,
      settings: () => ({
        paused: settings.current.paused,
        zoom: generated || fixture === "crossing" ? 0.225 : 0.625,
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
        c.dataset.playerX = String(p.position.wx);
        c.dataset.playerY = String(p.position.wy);
        c.dataset.playerZ = String(p.wz ?? 0);
        c.dataset.serverZ = String(server.wz ?? 0);
        c.dataset.support = describeSurfaceSupport(h.session.view.props, p);
        c.dataset.space = locateSurfaceSpace(h.session.view.props, p);
        c.dataset.serverSpace = locateSurfaceSpace(h.session.view.props, server);
        c.dataset.visibility = settings.current.visibility;
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
        }
        const next = `Height ${(p.wz ?? 0).toFixed(1)} · ${c.dataset.support} · space ${c.dataset.space}`;
        if (next !== lastStatus && alive) {
          lastStatus = next;
          setStatus(next);
        }
      },
      onError: (reason) => {
        delete c.dataset.ready;
        if (alive) setError(String(reason));
      },
    });
    scene.current = host;
    c.__physicsSample = (reset) => host.session.samplePhysicsDiagnostics(reset);
    c.__presentationDiagnostics = () => host.getDiagnostics();
    void host.ready
      .then(() => {
        if (alive) c.dataset.ready = "true";
      })
      .catch((reason) => {
        if (alive) setError(String(reason));
      });
    const release = () => keys.current.clear();
    window.addEventListener("blur", release);
    return () => {
      alive = false;
      delete c.dataset.ready;
      delete c.__physicsSample;
      delete c.__presentationDiagnostics;
      host.dispose();
      scene.current = null;
      keys.current.clear();
      window.removeEventListener("blur", release);
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
      <h1>World geometry lab</h1>
      <p>
        Walk ramps, cross bridges, pass underneath and drive ordinary upright cars. Arrows/WASD
        move, Space jumps, E enters or leaves a nearby car, R reverses. Touch and controller use the
        same controls. Specialized equipment and train services are deferred.
      </p>
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
            {VEHICLE_MODELS.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </label>
      )}
      <div className="actions">
        {Object.entries(starts).map(([name, start]) => (
          <button
            key={name}
            type="button"
            onClick={() => {
              void scene.current
                ?.command({ kind: "teleport", ...start })
                .catch((e) => setError(String(e)));
              canvas.current?.focus();
            }}
          >
            {name}
          </button>
        ))}
        {vehicle && (
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
