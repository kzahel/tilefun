import { useEffect, useMemo, useRef, useState } from "react";
import { required } from "../art/ArtCatalog.js";
import { cityParkingRecipe } from "../scenarios/CityParkingRecipe.js";
import { ScenarioPresentationHost } from "../scenarios/ScenarioPresentationHost.js";
import type { ScenarioResponse } from "../scenarios/ScenarioProtocol.js";
import { ErrorMessage } from "./App.js";

export interface ParkingCanvas extends HTMLCanvasElement {
  __presentationDiagnostics?: () => ReturnType<ScenarioPresentationHost["getDiagnostics"]>;
}

export function ParkingPlay() {
  const recipe = useMemo(cityParkingRecipe, []);
  const canvas = useRef<ParkingCanvas>(null);
  const scene = useRef<ScenarioPresentationHost | null>(null);
  const keys = useRef(new Set<string>());
  const [paused, setPaused] = useState(false),
    [restart, setRestart] = useState(0);
  const [zoom, setZoom] = useState(0.24);
  const [error, setError] = useState<unknown>(null);
  const [status, setStatus] = useState<ScenarioResponse["parking"]>();
  const settings = useRef({ paused, zoom, terrainPacing: "responsive" as const });
  settings.current = { ...settings.current, paused, zoom };
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    c.dataset.restart = String(restart);
    let alive = true,
      last = "";
    setError(null);
    const host = new ScenarioPresentationHost(c, recipe, {
      defaultRenderer: "gpu-mesh",
      width: 960,
      height: 720,
      fixedCamera: { wx: recipe.player.position.wx + 32, wy: recipe.player.position.wy + 352 },
      settings: () => settings.current,
      input: () => ({
        dx: Number(keys.current.has("ArrowRight")) - Number(keys.current.has("ArrowLeft")),
        dy: Number(keys.current.has("ArrowDown")) - Number(keys.current.has("ArrowUp")),
        jump: keys.current.has(" "),
        sprinting: false,
      }),
      onError: (e) => {
        if (alive) setError(e);
        delete c.dataset.ready;
      },
      onFrame: (h) => {
        const p = h.session.parking;
        if (!p) return;
        c.dataset.parking = JSON.stringify(p);
        c.dataset.clock = JSON.stringify(h.session.clock);
        c.dataset.poses = JSON.stringify(
          h.session.view.entities
            .filter(
              (e) => e.type.startsWith("vehicle-v1:") || p.visits.some((v) => v.shopperId === e.id),
            )
            .map((e) => ({
              type: e.type,
              position: e.position,
              direction: e.sprite?.direction,
              moving: e.sprite?.moving,
            }))
            .sort(
              (a, b) =>
                a.type.localeCompare(b.type) ||
                a.position.wx - b.position.wx ||
                a.position.wy - b.position.wy,
            ),
        );
        const signature = JSON.stringify(p);
        if (signature !== last && alive) {
          last = signature;
          setStatus(p);
        }
      },
    });
    scene.current = host;
    c.__presentationDiagnostics = () => host.getDiagnostics();
    void host.ready
      .then(() => {
        if (alive) c.dataset.ready = "true";
      })
      .catch((e) => {
        if (alive) setError(e);
      });
    const clear = () => keys.current.clear();
    window.addEventListener("blur", clear);
    return () => {
      alive = false;
      host.dispose();
      scene.current = null;
      delete c.__presentationDiagnostics;
      delete c.dataset.ready;
      keys.current.clear();
      window.removeEventListener("blur", clear);
    };
  }, [restart, recipe]);
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
    <div className="parking-play">
      <h2>City shopping trips</h2>
      <a
        href={`/tilefun/?${new URLSearchParams({ generation: JSON.stringify(recipe.generation), arrival: JSON.stringify({ x: recipe.player.position.wx / 16, y: recipe.player.position.wy / 16, generation: recipe.generation }) })}`}
      >
        Play this city in a new world
      </a>
      <p>
        This is a generated city shopping center, using the same city planner and terrain as the
        main game. Follow the blue car from the boulevard, into its space, and back to road traffic.
        One shopper visits at a time; cars wait if you block their route.
      </p>
      <div className="actions">
        <button type="button" onClick={() => setPaused(!paused)}>
          {paused ? "Resume trips" : "Pause trips"}
        </button>
        <button
          type="button"
          onClick={() => {
            void scene.current?.session
              .reload()
              .then(() => {
                if (canvas.current)
                  canvas.current.dataset.reloadCount = String(
                    Number(canvas.current.dataset.reloadCount ?? 0) + 1,
                  );
              })
              .catch(setError);
          }}
        >
          Save / reload trips
        </button>
        <button
          type="button"
          onClick={() => {
            setRestart(restart + 1);
          }}
        >
          Reset trips
        </button>
        <label>
          Zoom{" "}
          <select
            aria-label="Shopping trip zoom"
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
          >
            <option value={0.24}>Whole lot</option>
            <option value={0.33}>Closer</option>
            <option value={0.5}>Native detail</option>
          </select>
        </label>
      </div>
      <p role="status">
        {status
          ? `${status.maneuvers} / 1 cars maneuvering · ${status.completed} completed shopping trips`
          : "Opening the shopping center…"}
      </p>
      <ErrorMessage error={error} />
      <div style={{ position: "relative", maxWidth: 960 }}>
        <canvas
          ref={canvas}
          aria-label="Playable shopping center"
          tabIndex={0}
          style={{ display: "block", width: "100%", borderRadius: 12, touchAction: "none" }}
          onKeyDown={(e) => {
            if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) {
              e.preventDefault();
              keys.current.add(e.key);
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
            style={{ touchAction: "none", minWidth: 48, minHeight: 48 }}
          >
            {label}
          </button>
        ))}
      </div>
      <p>
        Walk with the arrows or buttons; Space jumps. Cars wait for you if you block their route.
        Visits resume from the same moment after saving and reloading.
      </p>
      {status && (
        <ul className="parking-trip-list">
          {status.visits.map((v) => (
            <li key={v.id}>
              Car {v.id.replace("shopper-", "")}: {v.phase.replaceAll("-", " ")}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
