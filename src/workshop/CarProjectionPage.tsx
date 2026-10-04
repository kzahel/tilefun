import { useEffect, useRef, useState } from "react";
import { loadVerifiedArtImage } from "../art/ArtSource.js";
import { CAR_PROXY } from "../projection/CarProxy.js";
import {
  CarProxyScene,
  type GeometryCheck,
  type ProxyOptions,
  type ProxyView,
  type SourceComparison,
} from "../projection/CarProxyScene.js";
import "./car-projection.css";

export default function CarProjectionPage() {
  const canvas = useRef<HTMLCanvasElement>(null),
    source = useRef<HTMLCanvasElement>(null),
    scene = useRef<CarProxyScene | null>(null);
  const [options, setOptions] = useState<ProxyOptions>({
    view: "orbit",
    collision: false,
    wire: false,
    missing: true,
  });
  const [comparison, setComparison] = useState<SourceComparison | null>(null),
    [error, setError] = useState("");
  const [geometry, setGeometry] = useState<GeometryCheck | null>(null);
  const latest = useRef(options);
  latest.current = options;
  useEffect(() => {
    let active = true;
    void loadVerifiedArtImage({
      id: "me-complete",
      name: "Approved car source",
      image: CAR_PROXY.atlas,
      width: CAR_PROXY.atlasSize[0],
      height: CAR_PROXY.atlasSize[1],
      tileSize: 16,
      fingerprint: CAR_PROXY.sourceFingerprint,
      source: "src/traffic/vehicles-v1.json",
    })
      .then((image) => {
        if (!active || !canvas.current) return;
        const renderer = new CarProxyScene(canvas.current, image);
        scene.current = renderer;
        renderer.setOptions(latest.current);
        const s = source.current;
        if (s) {
          s.width = 64;
          s.height = 40;
          s.getContext("2d")?.drawImage(renderer.sourceCanvas, 0, 0);
        }
        setComparison(renderer.compareSource());
        setGeometry(renderer.checkGeometry());
      })
      .catch((e) => {
        if (active) setError(String(e));
      });
    return () => {
      active = false;
      scene.current?.dispose();
      scene.current = null;
    };
  }, []);
  useEffect(() => {
    scene.current?.setOptions(options);
  }, [options]);
  return (
    <section className="car-projection">
      <p className="eyebrow">SPRITE → 3D / EXPERIMENT</p>
      <h1>Car projection lab</h1>
      <p>
        The same pixels, given depth. Drag to orbit; pinch or scroll to zoom. Amber checks mark
        surfaces this side-view artwork never shows. Side and top presets are orthographic: drag to
        pan and pinch or scroll to zoom.
      </p>
      <fieldset className="actions" aria-label="Camera presets">
        {(
          [
            ["source", "Source view"],
            ["side", "Side · ortho"],
            ["top", "Top · ortho"],
            ["orbit", "Orbit view"],
            ["back", "Far side"],
            ["low", "Low view"],
          ] as [ProxyView, string][]
        ).map(([view, label]) => (
          <button
            type="button"
            key={view}
            aria-pressed={options.view === view}
            onClick={() => {
              setOptions({ ...options, view });
              scene.current?.setOptions({ ...options, view }, true);
            }}
          >
            {label}
          </button>
        ))}
      </fieldset>
      <div className="proxy-stage">
        <canvas ref={canvas} aria-label="Orbitable textured car" tabIndex={0} />
      </div>
      {error ? <p role="alert">{error}</p> : null}
      <div className="proxy-controls">
        {(
          [
            ["collision", "Approved collision"],
            ["wire", "Visual mesh edges"],
            ["missing", "Show unseen surfaces"],
          ] as const
        ).map(([key, label]) => (
          <label key={key}>
            <input
              type="checkbox"
              checked={options[key]}
              onChange={(e) => setOptions({ ...options, [key]: e.target.checked })}
            />
            {label}
          </label>
        ))}
      </div>
      <div className="proxy-comparison">
        <figure>
          <canvas ref={source} aria-label="Original car artwork" />
          <figcaption>Original artwork · 64 × 40 body crop</figcaption>
        </figure>
        <div>
          <h2>One view, real depth</h2>
          <p>
            The bonnet, windscreen, roof and side are fitted surfaces. The source image stays
            attached as the camera moves. The wheels on the near side are still painted into that
            surface.
          </p>
          <p>
            Pink shows the unchanged approved collision box: {CAR_PROXY.collision.width} ×{" "}
            {CAR_PROXY.collision.depth} × {CAR_PROXY.collision.height}. Blue edges show the
            experimental visual shape. Their differences are intentional inspection targets.
          </p>
          {comparison ? (
            <p
              role="status"
              data-testid="source-comparison"
              data-source={comparison.sourcePixels}
              data-covered={comparison.covered}
              data-matching={comparison.matching}
              data-extra={comparison.extra}
            >
              Source-camera check: {comparison.covered} / {comparison.sourcePixels} painted pixels
              covered; {comparison.matching} match within one color level. {comparison.extra} extra
              pixels extend the top edges to close seams. Checked without the ground, collision box
              or amber surfaces.
            </p>
          ) : (
            !error && <p role="status">Preparing the car…</p>
          )}
          {geometry && (
            <p
              role="status"
              data-testid="geometry-check"
              data-side-top={geometry.sideTopPixels}
              data-top-covered={geometry.topPixels}
              data-top-expected={geometry.topExpected}
              data-front-contact={geometry.frontContactPixels}
              data-rear-contact={geometry.rearContactPixels}
              data-below-ground={geometry.belowGroundPixels}
            >
              Orthographic checks: {geometry.sideTopPixels} top-face pixels visible from the side;{" "}
              {geometry.topPixels} / {geometry.topExpected} top-view pixels filled. Both tires{" "}
              {geometry.frontContactPixels > 0 && geometry.rearContactPixels > 0
                ? "touch"
                : "do not both touch"}{" "}
              ground; {geometry.belowGroundPixels} pixels below it.
            </p>
          )}
          <p>
            This is an unapproved visual study. Hidden faces, separate wheels and interior artwork
            would need further authoring. Gameplay physics and artwork are unchanged.
          </p>
          <a href="/tilefun/workshop.html#/tool/vehicles?view=vehicle%3Acompact-1%3Aeast">
            Inspect the original vehicle geometry →
          </a>
        </div>
      </div>
    </section>
  );
}
