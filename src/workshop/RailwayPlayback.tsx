import { type RefObject, useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { drawRailway, railCase } from "../railway/RailwayPreview.js";
import { railwayImage } from "./RailwayCandidates.js";
import "./railways.css";

/** Display controls never enter a candidate identity or alter its canonical samples. */
export function RailwayPlayback({
  id,
  canvas,
  ready,
  geometry,
  onError,
}: {
  id: string;
  canvas: RefObject<HTMLCanvasElement | null>;
  ready: boolean;
  geometry: boolean;
  onError: (error: string) => void;
}) {
  const c = railCase(id),
    animated = !["patterns", "corners", "junction-art", "network"].includes(c.scene);
  const [playing, setPlaying] = useState(true),
    [speed, setSpeed] = useState(1),
    [cutaway, setCutaway] = useState(false),
    [shownTime, setShownTime] = useState(0);
  const time = useRef(0),
    options = useRef({ playing, speed, geometry, cutaway });
  options.current = { playing, speed, geometry, cutaway };
  useEffect(() => {
    if (!ready) return;
    let active = true,
      frame = 0;
    void railwayImage()
      .then((image) => {
        if (!active) return;
        let last = performance.now(),
          lastLabel = 0;
        const draw = (now: number) => {
          if (!active || !canvas.current) return;
          const o = options.current;
          if (o.playing && animated)
            time.current += Math.max(0, Math.min(0.1, (now - last) / 1000)) * o.speed;
          last = now;
          drawRailway(canvas.current, image, c, time.current, o.geometry, o.cutaway);
          if (now - lastLabel > 100) {
            setShownTime(time.current);
            lastLabel = now;
          }
          frame = requestAnimationFrame(draw);
        };
        frame = requestAnimationFrame(draw);
      })
      .catch((e) => onError(String(e)));
    return () => {
      active = false;
      cancelAnimationFrame(frame);
    };
  }, [ready, canvas, animated, c, onError]);
  return (
    <div className="railway-controls">
      {c.scene === "motion" ? (
        <nav className="actions" aria-label="Train directions">
          {(["east", "west", "north", "south"] as const).map((direction) => (
            <Link
              className="button"
              key={direction}
              aria-current={c.direction === direction ? "page" : undefined}
              to={`/review/${encodeURIComponent(`pattern:rail-v1-${c.color?.toLowerCase()}-${direction}`)}?show=all`}
            >
              {direction}
            </Link>
          ))}
        </nav>
      ) : null}
      <p className="notice">Workshop prototype · your review comes before overworld integration.</p>
      {animated ? (
        <div className="actions">
          <button type="button" disabled={!ready} onClick={() => setPlaying(!playing)}>
            {playing ? "Pause motion" : "Play motion"}
          </button>
          <button
            type="button"
            disabled={!ready}
            onClick={() => {
              time.current = 0;
              setShownTime(0);
            }}
          >
            Restart motion
          </button>
          <label>
            Playback speed{" "}
            <select
              aria-label="Playback speed"
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
            >
              <option value={0.1}>0.1× · very slow</option>
              <option value={0.25}>0.25× · slow</option>
              <option value={1}>1× · normal</option>
            </select>
          </label>
          <label>
            Preview time{" "}
            <input
              aria-label="Preview time"
              type="range"
              min="0"
              max="24"
              step="0.1"
              value={shownTime % 24}
              onChange={(e) => {
                time.current = Number(e.target.value);
                setShownTime(time.current);
                setPlaying(false);
              }}
            />
          </label>
          <output aria-label="Motion time">{shownTime.toFixed(1)}s</output>
        </div>
      ) : null}
      {c.scene === "tunnel" ? (
        <label>
          <input type="checkbox" checked={cutaway} onChange={(e) => setCutaway(e.target.checked)} />{" "}
          Tunnel cutaway
        </label>
      ) : null}
      {["network", "terminal", "hub", "through", "bridge", "tunnel", "bend", "crossover"].includes(
        c.scene,
      ) ? (
        <p className="muted">
          Gold: proposed route / switch geometry. Cyan: proposed access / structure. These shapes
          are layout placeholders, not approved tiles or collision.
        </p>
      ) : null}
    </div>
  );
}
