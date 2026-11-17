import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { type GameAssets, loadTerrainAssets } from "../assets/GameAssets.js";
import type { BaseFill } from "../autotile/BlendGraph.js";
import { ALL_TERRAIN_IDS, TerrainId, toBaseTerrainId, VariantId } from "../autotile/TerrainId.js";
import { TopDownPreview } from "../rendering/TopDownPreview.js";
import { drawStudySamples, drawStudyStack, drawTerrainStudy } from "./TerrainBlendPreview.js";
import {
  inspectStudyTile,
  MATERIAL_COLOURS,
  MATERIAL_NAMES,
  STUDY_ADJACENCY,
  STUDY_GRAPH,
  studySample,
  TERRAIN_STUDIES,
  terrainStudy,
} from "./TerrainBlendStudy.js";
import "./terrain-blends.css";

const VARIANT_CHOICES = [
  { id: VariantId.ShallowWaterOnGrass, name: "Shallow water · prefer grass base" },
  { id: VariantId.GrassOnDirtWarm, name: "Grass · prefer warm dirt base" },
  { id: VariantId.GrassAlpha, name: "Grass · prefer overlay" },
  { id: VariantId.SandAlpha, name: "Sand · prefer overlay" },
  { id: VariantId.SandLightAlpha, name: "Light sand · prefer overlay" },
];
const materialChoices = ALL_TERRAIN_IDS.map((id) => ({ id, name: MATERIAL_NAMES[id] }));

export default function TerrainBlendPage() {
  const [params, setParams] = useSearchParams();
  const example = TERRAIN_STUDIES.find((s) => s.id === params.get("case")) ?? TERRAIN_STUDIES[0];
  const [foreground, setForeground] = useState<number>(TerrainId.ShallowWater);
  const [background, setBackground] = useState(TerrainId.Grass);
  const [bridges, setBridges] = useState(2);
  const [selected, setSelected] = useState({ x: 12, y: 12 });
  const [assets, setAssets] = useState<GameAssets | null>(null);
  const [error, setError] = useState("");
  const gpuCanvas = useRef<HTMLCanvasElement>(null),
    sampleCanvas = useRef<HTMLCanvasElement>(null);
  const gpu = useRef<TopDownPreview | null>(null);
  const study = useMemo(
    () => terrainStudy(example.id, foreground, background, bridges),
    [example.id, foreground, background, bridges],
  );
  const tile = { x: Math.min(selected.x, study.size - 1), y: Math.min(selected.y, study.size - 1) };
  const tx = study.x + tile.x,
    ty = study.y + tile.y;
  const result = inspectStudyTile(study, tx, ty);
  const raw = studySample(study, tx * 2 + 1, ty * 2 + 1);
  const pair = STUDY_GRAPH.getBlend(toBaseTerrainId(foreground), background);
  const reverse = STUDY_GRAPH.getBlend(background, toBaseTerrainId(foreground));
  const route = STUDY_ADJACENCY.getBridgePath(toBaseTerrainId(foreground), background);
  const paired = !["pond", "junction", "thin-bands", "wide-bands"].includes(example.id);

  useEffect(() => {
    let active = true;
    if (!gpuCanvas.current) return;
    let renderer: TopDownPreview;
    try {
      // Each effect owns its GPU canvas, including React's setup/cleanup probe.
      // The visible canvas is a snapshot of the completed GPU frame.
      renderer = new TopDownPreview(document.createElement("canvas"));
    } catch (e) {
      setError(String(e));
      return;
    }
    gpu.current = renderer;
    void loadTerrainAssets(STUDY_GRAPH)
      .then((loaded) => {
        if (!active) {
          closeAssets(loaded);
          return;
        }
        renderer.setAssets(loaded, STUDY_GRAPH);
        setAssets(loaded);
      })
      .catch((e: unknown) => {
        if (active) setError(String(e));
      });
    return () => {
      active = false;
      gpu.current = null;
      renderer.dispose();
    };
  }, []);
  useEffect(
    () => () => {
      if (assets) closeAssets(assets);
    },
    [assets],
  );
  useEffect(() => {
    if (!assets || !gpu.current || !sampleCanvas.current || !gpuCanvas.current) return;
    try {
      drawTerrainStudy(gpu.current, study);
      const canvas = gpuCanvas.current;
      canvas.width = canvas.height = study.size * 16;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw Error("Terrain snapshot unavailable");
      ctx.drawImage(gpu.current.renderer.surface.canvas, 0, 0);
      drawStudySamples(sampleCanvas.current, study);
      setError("");
    } catch (e) {
      setError(String(e));
    }
  }, [assets, study]);

  const chooseCase = (id: string) => {
    setParams({ case: id });
    if (id === "paint") {
      setForeground(TerrainId.DeepWater);
      setBackground(TerrainId.DirtWarm);
    }
  };
  const sourceLabel = (entry: typeof pair) =>
    entry
      ? `${entry.sheetKey} · ${entry.isAlpha ? "transparent fallback" : "opaque pair artwork"}`
      : "No sheet in this direction";
  const sprite = (
    s: BaseFill | undefined,
    cumulative = false,
    sprites: readonly BaseFill[] = s ? [s] : [],
  ) =>
    assets ? (
      <TileCrop assets={assets} sprites={sprites} cumulative={cumulative} base={result.base} />
    ) : null;
  const selectFromCanvas = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setSelected({
      x: Math.min(
        study.size - 1,
        Math.max(0, Math.floor(((event.clientX - rect.left) / rect.width) * study.size)),
      ),
      y: Math.min(
        study.size - 1,
        Math.max(0, Math.floor(((event.clientY - rect.top) / rect.height) * study.size)),
      ),
    });
  };

  return (
    <section
      className="terrain-blend-lab"
      data-terrain-study-ready={assets && !error ? "true" : "false"}
    >
      <h1>Terrain blend lab</h1>
      <p>
        One boundary at a time: compare the material samples with the game’s terrain artwork, then
        inspect the tile that looks wrong.
      </p>
      <p className="notice">
        26 source sheets · 47 blob shapes per sheet · 9 active ground materials · up to 6 transition
        layers per tile. Dedicated pair tiles already contain both materials. Transparent overlays
        leave the background visible.
      </p>
      <div className="terrain-blend-controls">
        <label>
          Example{" "}
          <select
            aria-label="Example"
            value={example.id}
            onChange={(e) => chooseCase(e.target.value)}
          >
            {TERRAIN_STUDIES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        {paired && (
          <>
            <label>
              Foreground{" "}
              <select
                aria-label="Foreground"
                value={foreground}
                onChange={(e) => setForeground(Number(e.target.value))}
              >
                {[...materialChoices, ...VARIANT_CHOICES].map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Background{" "}
              <select
                aria-label="Background"
                value={background}
                onChange={(e) => setBackground(Number(e.target.value) as TerrainId)}
              >
                {materialChoices.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        {example.id === "paint" && (
          <label>
            Editor bridges{" "}
            <select
              aria-label="Editor bridges"
              value={bridges}
              onChange={(e) => setBridges(Number(e.target.value))}
            >
              <option value={0}>Off · full tile stamp</option>
              <option value={2}>2 steps · cross stamp</option>
            </select>
          </label>
        )}
      </div>
      <p>
        <strong>Look for:</strong> {example.question}
      </p>
      {paired && (
        <p>
          Foreground → background: {sourceLabel(pair)}. Reverse: {sourceLabel(reverse)}.<br />
          Editor adjacency:{" "}
          {STUDY_ADJACENCY.isValidAdjacency(toBaseTerrainId(foreground), background)
            ? "allowed without an inserted band"
            : route
              ? `bridge via ${route.map((t) => MATERIAL_NAMES[t]).join(" → ")}`
              : "no bridge route"}
          . A permitted adjacency is not a visual quality guarantee.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      {!assets && !error && <p role="status">Loading terrain artwork…</p>}
      <div className="terrain-blend-maps">
        {[
          {
            ref: sampleCanvas,
            label: "Material samples",
            note: "False colours before blending; each square is half a tile. White dots mark brush variants.",
          },
          {
            ref: gpuCanvas,
            label: "Game terrain artwork",
            note: "Production autotiler and WebGL terrain renderer, without trees, shadows or actors.",
          },
        ].map((m) => (
          <figure key={m.label}>
            <figcaption>
              <strong>{m.label}</strong>
              <p>{m.note}</p>
            </figcaption>
            <div className="terrain-blend-map">
              <canvas ref={m.ref} aria-label={m.label} onPointerDown={selectFromCanvas} />
              <div
                className="terrain-blend-selection"
                style={{
                  left: `${(tile.x / study.size) * 100}%`,
                  top: `${(tile.y / study.size) * 100}%`,
                  width: `${100 / study.size}%`,
                  height: `${100 / study.size}%`,
                }}
              />
            </div>
          </figure>
        ))}
      </div>
      <div className="terrain-blend-legend">
        {ALL_TERRAIN_IDS.map((id) => (
          <span key={id}>
            <i style={{ background: MATERIAL_COLOURS[id] }} />
            {MATERIAL_NAMES[id]}
          </span>
        ))}
      </div>
      <h2>Inspect a tile</h2>
      <div className="terrain-blend-controls">
        <span>Tap either map, or choose tile</span>
        {(["x", "y"] as const).map((axis) => (
          <label key={axis}>
            {axis.toUpperCase()}{" "}
            <select
              aria-label={`Tile ${axis.toUpperCase()}`}
              value={tile[axis]}
              onChange={(e) => setSelected({ ...tile, [axis]: Number(e.target.value) })}
            >
              {Array.from({ length: study.size }, (_, n) => n).map((coordinate) => (
                <option key={coordinate} value={coordinate}>
                  {coordinate}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <p>
        World tile ({tx}, {ty}) · painted centre: {MATERIAL_NAMES[toBaseTerrainId(raw)]}
        {raw !== toBaseTerrainId(raw)
          ? ` (${VARIANT_CHOICES.find((v) => v.id === raw)?.name})`
          : ""}{" "}
        · chosen background: <strong>{MATERIAL_NAMES[result.base]}</strong>.
      </p>
      <table className="terrain-blend-neighbours" aria-label="Selected tile input samples">
        <tbody>
          {[-1, 0, 1].map((dy) => (
            <tr key={dy}>
              {[-1, 0, 1].map((dx) => {
                const material = toBaseTerrainId(
                  studySample(study, 2 * tx + 1 + dx, 2 * ty + 1 + dy),
                );
                return (
                  <td key={dx} style={{ borderColor: MATERIAL_COLOURS[material] }}>
                    {dx === 0 && dy === 0 ? (
                      <strong>Centre: {MATERIAL_NAMES[material]}</strong>
                    ) : (
                      MATERIAL_NAMES[material]
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        Draw order is top to bottom. An opaque pair can cover everything drawn earlier; alpha edges
        are drawn last.
      </p>
      <div className="terrain-blend-table">
        <table>
          <thead>
            <tr>
              <th>Layer</th>
              <th>Source</th>
              <th>Tile alone</th>
              <th>Result so far</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Shallow-water undercoat</td>
              <td>me03 (1, 0)</td>
              <td>
                {sprite({
                  sheetIndex: STUDY_GRAPH.allSheets.findIndex((s) => s.sheetKey === "me03"),
                  col: 1,
                  row: 0,
                })}
              </td>
              <td>Always below the ground</td>
            </tr>
            <tr>
              <td>Background fill · {MATERIAL_NAMES[result.base]}</td>
              <td>Solid material fill</td>
              <td>{sprite(STUDY_GRAPH.getBaseFill(result.base))}</td>
              <td>{sprite(undefined, true)}</td>
            </tr>
            {result.layers.map((layer, i) => (
              <tr key={`${layer.terrain}:${layer.sheetIndex}:${layer.mask}`}>
                <td>
                  {i + 1}. {MATERIAL_NAMES[layer.terrain]} ·{" "}
                  {layer.isAlpha ? "alpha" : "opaque pair"}
                </td>
                <td>
                  {layer.sheetKey} ({layer.col}, {layer.row})<br />
                  mask {layer.rawMask} → {layer.mask}
                </td>
                <td>{sprite(layer)}</td>
                <td>{sprite(undefined, true, result.layers.slice(0, i + 1))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!result.layers.length && <p>This tile has no transition layers.</p>}
      <details>
        <summary>Which material pairs have artwork?</summary>
        <p>
          Rows are the overlay, columns its background. A sheet name is a dedicated opaque pair; α
          is a transparent fallback; — has no directional sheet. Select a pair to see its straight
          edge. The actual tile may choose the opposite background.
        </p>
        <div className="terrain-blend-table">
          <table>
            <thead>
              <tr>
                <th>Overlay ↓ / background →</th>
                {ALL_TERRAIN_IDS.map((t) => (
                  <th key={t}>{MATERIAL_NAMES[t]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ALL_TERRAIN_IDS.map((a) => (
                <tr key={a}>
                  <th>{MATERIAL_NAMES[a]}</th>
                  {ALL_TERRAIN_IDS.map((b) => {
                    const entry = STUDY_GRAPH.getBlend(a, b);
                    return (
                      <td key={b}>
                        {a === b ? (
                          "Solid"
                        ) : (
                          <button
                            type="button"
                            title={`${MATERIAL_NAMES[a]} over ${MATERIAL_NAMES[b]}`}
                            onClick={() => {
                              setForeground(a);
                              setBackground(b);
                              setParams({ case: "straight" });
                            }}
                          >
                            {entry ? `${entry.isAlpha ? "α " : ""}${entry.sheetKey}` : "—"}
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <details>
        <summary>What would count as a good blend?</summary>
        <ul>
          <li>
            Boundaries stay connected through straight edges, inside/outside corners and diagonals.
          </li>
          <li>
            Narrow strips keep their material and width; unexpected islands, teeth and holes are
            visible failures.
          </li>
          <li>
            Three-way joins preserve all intended regions; an opaque pair must not erase a third
            material.
          </li>
          <li>
            The visible material agrees with the painted samples. Any deliberate shoreline inset
            should be consistent.
          </li>
          <li>
            Repeated edge motifs, abrupt palette changes and different-looking reversed pairs need
            visual review.
          </li>
        </ul>
        <p>
          These are proposed review questions, not automatic approvals. Start with one preferred
          shoreline before changing the world’s material rules.
        </p>
      </details>
      <p>
        <Link to="/tool/patterns?family=terrain-v1">Free terrain painting</Link> ·{" "}
        <a href="assets/tilesets/me-autotile-viewer.html">All 26 source sheets</a> ·{" "}
        <Link to="/tool/art?sheet=me-complete">Art workbench</Link>
      </p>
    </section>
  );
}

function TileCrop({
  assets,
  sprites,
  cumulative,
  base,
}: {
  assets: GameAssets;
  sprites: readonly BaseFill[];
  cumulative: boolean;
  base: TerrainId;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (canvas.current) drawStudyStack(canvas.current, assets, sprites, cumulative, base);
  }, [assets, sprites, cumulative, base]);
  return (
    <canvas
      ref={canvas}
      className="terrain-blend-crop"
      aria-label={cumulative ? "Composed tile" : "Source tile"}
    />
  );
}

function closeAssets(assets: GameAssets): void {
  const images = new Set([...assets.sheets.values()].map((s) => s.image));
  for (const image of images) if (image instanceof ImageBitmap) image.close();
}
