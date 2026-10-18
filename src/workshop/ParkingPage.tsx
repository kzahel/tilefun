import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { required } from "../art/ArtCatalog.js";
import { reviewContext2D } from "../art/reviewCanvas.js";
import {
  drawParkingStudy,
  PARKING_CASES,
  PARKING_KIT,
  parkingStudy,
} from "../art/studies/ParkingLotStudy.js";
import { ErrorMessage, reviewPath } from "./App.js";
import { ParkingPlay } from "./ParkingPlay.js";
import { PreviewViewport } from "./PreviewViewport.js";
import { reviewAssets } from "./ReviewAssets.js";
import "./parking.css";

export default function ParkingPage() {
  const [params, setParams] = useSearchParams();
  const c = PARKING_CASES.find((c) => c.id === params.get("case")) ?? required(PARKING_CASES[0]);
  const plan = parkingStudy(c.id);
  const live = params.get("play") === "1";
  const [cars, setCars] = useState(true),
    [grid, setGrid] = useState(false);
  const [error, setError] = useState<unknown>(null),
    [ready, setReady] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null),
    kit = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (live) return;
    let cancelled = false;
    setReady(false);
    setError(null);
    void reviewAssets()
      .then(({ assets }) => {
        if (cancelled || !canvas.current || !kit.current) return;
        const sheet = required(assets.sheets.get("me-complete"));
        drawParkingStudy(canvas.current, c.id, sheet, cars, grid);
        const target = kit.current;
        target.width = 640;
        target.height = 112;
        const ctx = reviewContext2D(target);
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = "#323240";
        ctx.fillRect(0, 0, target.width, target.height);
        for (const [i, item] of PARKING_KIT.entries()) {
          const [sx, sy, sw, sh] = item.rect;
          ctx.drawImage(
            sheet.image,
            sx,
            sy,
            sw,
            sh,
            i * 160 + (160 - sw) / 2,
            (112 - sh) / 2,
            sw,
            sh,
          );
        }
        setReady(true);
      })
      .catch((e) => {
        if (!cancelled) setError(e);
      });
    return () => {
      cancelled = true;
    };
  }, [c.id, cars, grid, live]);
  return (
    <section className="parking-lab" data-parking-ready={ready}>
      <div className="page-heading">
        <div>
          <p className="eyebrow">TOWN STRUCTURE STUDIES</p>
          <h1>Parking lot lab</h1>
          <p>A big place to park, walk to the shops, and meet up again.</p>
        </div>
        <span className="tag">Layout preview</span>
      </div>
      <div className="actions">
        <button type="button" aria-pressed={!live} onClick={() => setParams({ case: c.id })}>
          Layout patterns
        </button>
        <button
          type="button"
          aria-pressed={live}
          onClick={() => setParams({ play: "1", city: "1" })}
        >
          City shopping trips
        </button>
      </div>
      {live ? (
        <ParkingPlay />
      ) : (
        <>
          <fieldset className="parking-options" aria-label="Parking layouts">
            {PARKING_CASES.map((item) => (
              <button
                type="button"
                key={item.id}
                aria-pressed={c.id === item.id}
                onClick={() => setParams({ case: item.id })}
              >
                <strong>{item.name}</strong>
                <span>{item.description}</span>
              </button>
            ))}
          </fieldset>
          <div className="parking-summary">
            <div>
              <h2>{c.name}</h2>
              <p>{c.description}</p>
            </div>
            <Link className="button" to={reviewPath(`pattern:parking-v1-${c.id}`)}>
              Review this layout →
            </Link>
          </div>
          <ErrorMessage error={error} />
          <PreviewViewport
            width={plan.width}
            height={plan.height}
            status={
              ready
                ? `${plan.bays.length} spaces · ${cars ? plan.bays.filter((b) => b.occupied).length : 0} parked cars`
                : "Loading tiles…"
            }
            controls={
              <>
                <label>
                  <input
                    type="checkbox"
                    checked={cars}
                    onChange={(e) => setCars(e.target.checked)}
                  />{" "}
                  Show parked cars
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={grid}
                    onChange={(e) => setGrid(e.target.checked)}
                  />{" "}
                  Tile grid & drive aisles
                </label>
              </>
            }
          >
            <canvas ref={canvas} aria-label={`${c.name} parking layout`} />
          </PreviewViewport>
          <p className="parking-caption">
            The cars show how the spaces fit. City shopping trips uses the normal generated city and
            road traffic.
          </p>
          <div className="parking-kit">
            <h2>Parking tile kit</h2>
            <p>Original tile artwork, repeated at its native size.</p>
            <canvas ref={kit} aria-label="Native parking tile patterns" />
            <div className="parking-kit-labels">
              {PARKING_KIT.map((item) => (
                <span key={item.name}>{item.name}</span>
              ))}
            </div>
            <a href="/tilefun/art-workbench.html?sheet=me-complete&rect=0,1904,208,288">
              Inspect these source tiles ↗
            </a>
          </div>
        </>
      )}
    </section>
  );
}
