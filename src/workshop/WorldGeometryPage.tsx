import { useEffect, useMemo, useRef, useState } from "react";
import { required } from "../art/ArtCatalog.js";
import { locateSurfaceSpace } from "../physics/TerrainExcavation.js";
import { CURVE_TRAIN } from "../railway/CurveTrain.js";
import { railAlignment } from "../railway/RailPath.js";
import { interpolatePosition, interpolateWz } from "../rendering/EntityInterpolation.js";
import {
  describeSurfaceSupport,
  type SurfaceVisibility,
} from "../rendering/SurfacePresentation.js";
import { curvedTrainRecipe } from "../scenarios/CurvedTrainRecipe.js";
import {
  GENERATED_CROSSINGS,
  generatedCrossingRecipe,
} from "../scenarios/GeneratedCrossingRecipe.js";
import { CROSSING_STARTS, railCrossingRecipe } from "../scenarios/RailCrossingRecipe.js";
import { ScenarioPresentationHost } from "../scenarios/ScenarioPresentationHost.js";
import { TRAIN_GEOMETRY_STARTS, trainGeometryRecipe } from "../scenarios/TrainGeometryRecipe.js";
import { GARAGE_STARTS, undergroundGarageRecipe } from "../scenarios/UndergroundGarageRecipe.js";
import {
  VEHICLE_BRIDGE_STARTS,
  VEHICLE_GARAGE_STARTS,
  vehicleGeometryRecipe,
} from "../scenarios/VehicleGeometryRecipe.js";
import { GEOMETRY_STARTS, worldGeometryRecipe } from "../scenarios/WorldGeometryRecipe.js";
import { drawCurvedRailLayout } from "./CurvedTrainPreview.js";

export default function WorldGeometryPage() {
  const canvas = useRef<HTMLCanvasElement>(null),
    scene = useRef<ScenarioPresentationHost | null>(null);
  const [fixture, setFixture] = useState(
    () => new URLSearchParams(location.search).get("geometry") ?? "deck",
  );
  const generatedIndex = GENERATED_CROSSINGS.findIndex((c) => fixture === `generated-${c.seed}`);
  const generated = generatedIndex >= 0;
  const garage = fixture === "garage" || fixture === "car-garage",
    crossing = fixture === "crossing" || fixture === "car-bridge" || generated,
    vehicle = fixture === "car-garage" || fixture === "car-bridge",
    trainGrade = fixture === "train-grades";
  const trainCurve = fixture === "train-loop" || fixture === "train-winding";
  const [followTrain, setFollowTrain] = useState(!trainCurve);
  const [reverse, setReverse] = useState(false);
  const generatedScene = useMemo(
    () => (generatedIndex >= 0 ? generatedCrossingRecipe(generatedIndex, reverse) : undefined),
    [generatedIndex, reverse],
  );
  const curveRecipe = useMemo(
    () => (trainCurve ? curvedTrainRecipe(fixture === "train-loop", reverse) : undefined),
    [trainCurve, fixture, reverse],
  );
  const curveAlignment = curveRecipe?.railways?.[0]?.path
    ? railAlignment(curveRecipe.railways[0].path)
    : undefined;
  const keys = useRef(new Set<string>());
  const [error, setError] = useState(""),
    [restart, setRestart] = useState(0);
  const [paused, setPaused] = useState(false),
    [visibility, setVisibility] = useState<SurfaceVisibility>("auto");
  const [status, setStatus] = useState("Loading scene…");
  const settings = useRef({ paused, visibility, followTrain });
  settings.current = { paused, visibility, followTrain };
  // biome-ignore lint/correctness/useExhaustiveDependencies: restart replaces the keyed canvas and its Worker/renderer.
  useEffect(() => {
    const c = required(canvas.current);
    let alive = true,
      lastStatus = "";
    setError("");
    setPaused(false);
    keys.current.clear();
    const host = new ScenarioPresentationHost(
      c,
      curveRecipe ??
        (generatedScene
          ? generatedScene.recipe
          : trainGrade
            ? trainGeometryRecipe(reverse)
            : vehicle
              ? vehicleGeometryRecipe(garage, reverse)
              : crossing
                ? railCrossingRecipe()
                : garage
                  ? undergroundGarageRecipe()
                  : worldGeometryRecipe()),
      {
        width: 960,
        height: crossing ? 720 : 640,
        fixedCamera: generatedScene
          ? { wx: generatedScene.bridge.x * 16, wy: generatedScene.bridge.y * 16 - 16 }
          : trainGrade || trainCurve
            ? (_player, alpha) => {
                const middle = scene.current?.session.view.entities.find(
                  (e) => e.type === (trainCurve ? CURVE_TRAIN : "train-carriage-v1:middle"),
                );
                if (!settings.current.followTrain || !middle) return { wx: 0, wy: -16 };
                const p = interpolatePosition(middle.position, middle.prevPosition, alpha);
                return { wx: p.wx, wy: p.wy - (interpolateWz(middle, alpha) ?? 0) - 16 };
              }
            : { wx: crossing ? 0 : vehicle ? -48 : -16, wy: -16 },
        terrain: generated,
        surfaceVisibility: () => settings.current.visibility,
        settings: () => ({
          paused: settings.current.paused,
          zoom:
            trainGrade || trainCurve
              ? settings.current.followTrain
                ? 0.4
                : trainCurve
                  ? fixture === "train-loop"
                    ? 0.14
                    : 0.1
                  : 0.09
              : crossing
                ? 0.225
                : vehicle
                  ? 0.5
                  : 0.625,
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
          if (generated) return;
          if (curveAlignment) {
            drawCurvedRailLayout(frame, h.camera, curveAlignment);
            return;
          }
          const scale = h.camera.scale;
          if (trainGrade) {
            const a = h.camera.worldToScreen(-1728, -160);
            frame.rect(a.sx, a.sy, 3456 * scale, 320 * scale, "#edf1e8", "#7f928d");
            for (const y of [-8, 8]) {
              const p = h.camera.worldToScreen(-1664, y),
                q = h.camera.worldToScreen(1664, y);
              frame.line(p.sx, p.sy, q.sx, q.sy, "#47595f");
            }
            return;
          }
          if (crossing) {
            const a = h.camera.worldToScreen(-672, -400);
            frame.rect(a.sx, a.sy, 1344 * scale, 800 * scale, "#edf1e8", "#7f928d");
            for (let x = -640; x <= 640; x += 16) {
              const p = h.camera.worldToScreen(x, -12);
              frame.rect(p.sx, p.sy, 4 * scale, 24 * scale, "#9e8c70");
            }
            for (const y of [-8, 8]) {
              const p = h.camera.worldToScreen(-640, y),
                q = h.camera.worldToScreen(640, y);
              frame.line(p.sx, p.sy, q.sx, q.sy, "#47595f");
            }
            return;
          }
          const left = vehicle ? -352 : -256,
            right = vehicle ? 256 : 224;
          const a = h.camera.worldToScreen(left, -144);
          frame.rect(a.sx, a.sy, (right - left) * scale, 288 * scale, "#edf1e8", "#7f928d");
          for (let x = left; x <= right; x += 16) {
            const p = h.camera.worldToScreen(x, -144),
              q = h.camera.worldToScreen(x, 144);
            frame.line(p.sx, p.sy, q.sx, q.sy, "#d6ded5");
          }
          for (let y = -144; y <= 144; y += 16) {
            const p = h.camera.worldToScreen(left, y),
              q = h.camera.worldToScreen(right, y);
            frame.line(p.sx, p.sy, q.sx, q.sy, "#d6ded5");
          }
          if (garage) {
            const entry = h.camera.worldToScreen(-192, -32),
              room = h.camera.worldToScreen(0, -64);
            frame.rect(entry.sx, entry.sy, 192 * scale, 64 * scale, "#526567");
            frame.rect(room.sx, room.sy, 160 * scale, 128 * scale, "#526567");
          }
          const path = h.camera.worldToScreen(48, -144);
          if (!garage && settings.current.visibility !== "upper")
            frame.rect(path.sx, path.sy, 64 * scale, 288 * scale, "#bfcabd");
        },
        overlay: (frame) => {
          frame.label(
            trainCurve
              ? fixture === "train-loop"
                ? "TOWN LOOP · FOUR STOPS"
                : "WINDING INTER-TOWN ROUTE"
              : generated
                ? `GENERATED CROSSING · SEED ${GENERATED_CROSSINGS[generatedIndex]?.seed}`
                : trainGrade
                  ? "TRAIN GRADES"
                  : crossing
                    ? "ROAD OVER RAIL"
                    : garage
                      ? "STREET → GARAGE"
                      : "RAMP → DECK",
            35,
            38,
            "#253b42",
            "bold 16px sans-serif",
          );
          frame.label(
            trainCurve
              ? "Shared train simulation · schematic bodies and track · 8s station stops"
              : trainGrade
                ? "Bridge 64 · tunnel −96 · 8s stops · horizontal native carriages"
                : crossing
                  ? "Road 64 · train 0 · clearance 56 · train height 44"
                  : garage
                    ? vehicle
                      ? "Car floor −48 · street 0 · opposite direction starts a new run"
                      : "Walk right to descend · floor −48 · street 0"
                    : "Passage below runs north / south",
            35,
            62,
            "#435a60",
            "14px sans-serif",
          );
        },
        onFrame: (h) => {
          const player = h.session.view.playerEntity;
          c.dataset.generatedSeed = generatedScene
            ? String(generatedScene.recipe.generation.seed)
            : "";
          c.dataset.bridgeX = generatedScene ? String(generatedScene.bridge.x * 16) : "0";
          c.dataset.bridgeY = generatedScene ? String(generatedScene.bridge.y * 16) : "0";
          c.dataset.surfaceCount = String(
            h.session.view.props.filter((p) => p.collider?.surface).length,
          );
          c.dataset.playerX = String(player.position.wx);
          c.dataset.playerY = String(player.position.wy);
          c.dataset.playerZ = String(player.wz ?? 0);
          c.dataset.serverZ = String(h.session.view.serverPlayerEntity.wz ?? 0);
          c.dataset.support = describeSurfaceSupport(h.session.view.props, player);
          c.dataset.space = locateSurfaceSpace(h.session.view.props, player);
          c.dataset.serverSpace = locateSurfaceSpace(
            h.session.view.props,
            h.session.view.serverPlayerEntity,
          );
          c.dataset.visibility = settings.current.visibility;
          const carriages = h.session.view.entities
            .filter((e) => e.type.startsWith("train-carriage-v1:") || e.type === CURVE_TRAIN)
            .sort((a, b) => a.position.wx - b.position.wx);
          c.dataset.carriagePoses = JSON.stringify(
            carriages.map((e) => [e.position.wx, e.position.wy, e.sprite?.frameRow]),
          );
          c.dataset.carriageCount = String(carriages.length);
          c.dataset.carriageHeights = carriages.map((e) => (e.wz ?? 0).toFixed(2)).join(",");
          c.dataset.trainCamera = settings.current.followTrain ? "follow" : "overview";
          const train = h.session.view.entities.find(
            (e) =>
              e.type ===
              (trainCurve
                ? CURVE_TRAIN
                : trainGrade
                  ? "train-carriage-v1:middle"
                  : "train-local-v1"),
          );
          if (train) {
            c.dataset.trainY = String(train.position.wy);
            c.dataset.trainVy = String(train.velocity?.vy ?? 0);
            c.dataset.trainHeading = String(train.sprite?.frameRow ?? 0);
            c.dataset.trainX = String(train.position.wx);
            c.dataset.trainZ = String(train.wz ?? 0);
            c.dataset.trainVx = String(train.velocity?.vx ?? 0);
          }
          const car = h.session.view.entities.find((e) => e.type.startsWith("vehicle-v1:"));
          if (car) {
            c.dataset.carX = String(car.position.wx);
            c.dataset.carY = String(car.position.wy);
            c.dataset.carZ = String(car.wz ?? 0);
          }
          const next = `${trainGrade ? `Carriage heights ${c.dataset.carriageHeights} · ` : ""}${car ? `Car height ${(car.wz ?? 0).toFixed(1)} · ` : ""}Height ${(player.wz ?? 0).toFixed(1)} · ${c.dataset.support} · space ${c.dataset.space} · ${settings.current.visibility} view${train ? ` · train ${Math.round(train.position.wx)} (8s station stops)` : ""}`;
          if (next !== lastStatus && alive) {
            lastStatus = next;
            setStatus(next);
          }
        },
        onError: (e) => {
          delete c.dataset.ready;
          if (alive) setError(String(e));
        },
      },
    );
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
  }, [
    restart,
    garage,
    crossing,
    vehicle,
    reverse,
    trainGrade,
    trainCurve,
    curveRecipe,
    curveAlignment,
    fixture,
    generated,
    generatedIndex,
    generatedScene,
  ]);
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
        {trainCurve
          ? "Watch each carriage follow the rails through smooth corners. The loop circulates through four stops; the winding corridor serves two termini and a through station. Run either direction and save/reload mid-bend. Bodies, track and platforms are schematic review geometry; this is not yet in generated worlds."
          : generated
            ? "Explore a real generated road/rail crossing. Both ramps, the level railway and traffic routes come from the current regional generator. Initial car and train positions are staged near the crossing for review; save/reload uses the ordinary world machinery."
            : trainGrade
              ? "Follow three carriages over a bridge and down into a tunnel. Each body follows its own support height. The train stops eight seconds at each terminus and reverses. Native carriages stay horizontal, so slope joins are a visible limitation of this proof."
              : vehicle
                ? "Watch the car follow the ramp with full-body clearance. It stops at the far end. Run the opposite direction to start a fresh return trip. The chassis stays level in this first proof."
                : crossing
                  ? "Walk north over the road bridge and down the far ramp. The train passes east/west below, stops at each end for eight seconds, then reverses. Use trackside to inspect clearance from below."
                  : garage
                    ? "Walk right from the entrance to descend into the garage, then left to return to the street. Jump inside to test the ceiling. Street and garage starts share map coordinates at different heights."
                    : "Walk up the ramp, cross the deck, or pass underneath. Jump beneath the deck to test its ceiling; walk off an edge to fall."}{" "}
        Arrows/WASD move; Space jumps.
      </p>
      <p>
        Automatic cutaway reveals the space you occupy. View selection changes drawing only. This is
        diagnostic geometry, not finished building artwork.
      </p>
      <label>
        Fixture{" "}
        <select
          aria-label="Geometry fixture"
          value={fixture}
          onChange={(e) => {
            keys.current.clear();
            setFixture(e.target.value);
            const url = new URL(location.href);
            url.searchParams.set("geometry", e.target.value);
            history.replaceState(null, "", url);
          }}
        >
          {GENERATED_CROSSINGS.map((c) => (
            <option key={c.seed} value={`generated-${c.seed}`}>
              Generated bridge · {c.label}
            </option>
          ))}
          <option value="deck">Raised deck and passage</option>
          <option value="garage">Underground parking garage</option>
          <option value="crossing">Road bridge over railway</option>
          <option value="car-bridge">Car over railway bridge</option>
          <option value="car-garage">Car in underground garage</option>
          <option value="train-loop">Train around a town · four stops</option>
          <option value="train-winding">Winding train route between towns</option>
          <option value="train-grades">Train over bridge and through tunnel</option>
        </select>
      </label>
      <div className="actions geometry-controls">
        {(vehicle || trainGrade || trainCurve || generated) && (
          <button
            type="button"
            onContextMenu={(e) => e.preventDefault()}
            onClick={() => {
              setPaused(false);
              setReverse(!reverse);
            }}
          >
            Run opposite direction
          </button>
        )}
        {Object.entries(
          curveRecipe
            ? { observer: { position: curveRecipe.player.position, z: 0 } }
            : generatedScene
              ? generatedScene.starts
              : trainGrade
                ? TRAIN_GEOMETRY_STARTS
                : vehicle
                  ? garage
                    ? VEHICLE_GARAGE_STARTS
                    : VEHICLE_BRIDGE_STARTS
                  : crossing
                    ? CROSSING_STARTS
                    : garage
                      ? GARAGE_STARTS
                      : GEOMETRY_STARTS,
        ).map(([name, start]) => (
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
          <option value="lower">
            {garage || trainGrade ? "Underground + ramp" : "Lower passage"}
          </option>
          <option value="upper">
            {garage || trainGrade ? "Above ground" : "Upper deck + ramp"}
          </option>
        </select>
      </label>
      {(trainGrade || trainCurve) && (
        <label>
          Train camera{" "}
          <select
            aria-label="Train camera"
            value={followTrain ? "follow" : "overview"}
            onChange={(e) => setFollowTrain(e.target.value === "follow")}
          >
            <option value="follow">Follow train</option>
            <option value="overview">Whole route</option>
          </select>
        </label>
      )}
      <p role="status">{status}</p>
      {error ? <p role="alert">{error}</p> : null}
      <div style={{ position: "relative", maxWidth: 960, overflow: "hidden", borderRadius: 12 }}>
        <canvas
          key={`${fixture}-${restart}-${reverse}`}
          ref={canvas}
          width={960}
          height={crossing ? 720 : 640}
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
