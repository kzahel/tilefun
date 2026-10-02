import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { type ArtRect, validateRect } from "../art/ArtCatalog.js";
import type { ArtNote } from "../art/ArtNotes.js";
import {
  inferMetadata,
  OUTDOOR_CATEGORIES,
  OUTDOOR_KINDS,
  type OutdoorAsset,
  type OutdoorMetadata,
  outdoorId,
  parseOutdoorMetadata,
} from "../assets/outdoor/OutdoorCatalog.js";
import { ErrorMessage, threadPath } from "./App.js";
import { AssetThumbnail, OutdoorAssetBrowser } from "./OutdoorAssetBrowser.js";
import { OutdoorGeometryTest } from "./OutdoorGeometryTest.js";
import {
  assetNotes,
  assetReviewState,
  catalogAssets,
  useArtNotes,
  useOutdoorCatalog,
} from "./OutdoorQueries.js";
import { useSession } from "./WorkshopQueries.js";
import { useWorkspace } from "./WorkspaceStore.js";

export default function OutdoorPage() {
  const query = useOutdoorCatalog(),
    notes = useArtNotes(),
    session = useSession(),
    location = useLocation(),
    navigate = useNavigate();
  if (!query.data) return <ErrorMessage error={query.error} />;
  const { catalog, image } = query.data,
    assets = catalogAssets(catalog, notes.data ?? []),
    params = new URLSearchParams(location.search);
  let selected = assets.find((a) => a.id === params.get("asset"));
  let error = "";
  if (!selected && params.get("rect"))
    try {
      const rect = validateRect(params.get("rect")!.split(",").map(Number), catalog);
      selected = assets.find((a) => a.id === outdoorId(rect)) ?? {
        id: outdoorId(rect),
        rect,
        visualBounds: [0, 0, rect[2], rect[3]],
        aliases: [],
        metadata: inferMetadata("Unnamed selected region", "", rect),
        evidence: "inferred",
        runtimeTypes: [],
      };
    } catch (e) {
      error = String(e);
    }
  const reviewStates = Object.fromEntries(
    assets.map((a) => [a.id, assetReviewState(notes.data ?? [], a, catalog.sourceFingerprint)]),
  );
  const coverage = catalog.coverage;
  return (
    <section className="outdoor-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">MODERN EXTERIORS / SEMANTICS & GEOMETRY</p>
          <h1>Outdoor asset catalog</h1>
          <p>
            Browse families, correct names and test placement geometry. Inferred labels and
            candidate geometry await your review.
          </p>
        </div>
        <Link className="button" to="/tool/art?sheet=me-complete&view=sheet&coverage=gaps">
          Inspect atlas coverage →
        </Link>
      </div>
      <p className="notice compact">
        {assets.length.toLocaleString()} asset rectangles ·{" "}
        {coverage.originalMatched.toLocaleString()} original names ·{" "}
        {Math.round((coverage.indexedCells / coverage.occupiedCells) * 100)}% of occupied cells
        indexed · {coverage.gapCells.toLocaleString()} gap cells.{" "}
        <Link to="/tool/art?sheet=me-complete&view=sheet&coverage=gaps">Select missing art</Link>
      </p>
      <ErrorMessage error={error || notes.error} />
      <div className={`outdoor-layout ${selected ? "has-selection" : ""}`}>
        <OutdoorAssetBrowser
          assets={assets}
          image={image}
          selectedId={selected?.id}
          reviewStates={reviewStates}
          onSelect={(a) => navigate(`/tool/outdoor?asset=${encodeURIComponent(a.id)}`)}
        />
        {selected ? (
          <AssetInspector
            key={selected.id}
            asset={selected}
            image={image}
            sourceFingerprint={catalog.sourceFingerprint}
            revision={catalog.revision}
            notes={assetNotes(notes.data ?? [], selected, catalog.sourceFingerprint)}
            authenticated={!!session.data?.authenticated}
            close={() => navigate("/tool/outdoor")}
          />
        ) : null}
      </div>
    </section>
  );
}
function Numbers({
  name,
  values,
  change,
}: {
  name: string;
  values: number[];
  change: (n: number[]) => void;
}) {
  return (
    <fieldset className="number-fields">
      <legend>{name}</legend>
      {values.map((v, i) => (
        <label key={`${name}:${["X", "Y", "Width", "Height"][i]}`}>
          {["X", "Y", "Width", "Height"][i]}
          <input
            type="number"
            aria-label={`${name} ${["X", "Y", "Width", "Height"][i]}`}
            value={v}
            onChange={(e) => change(values.map((n, j) => (j === i ? Number(e.target.value) : n)))}
          />
        </label>
      ))}
    </fieldset>
  );
}
function AssetInspector({
  asset,
  image,
  sourceFingerprint,
  revision,
  notes,
  authenticated,
  close,
}: {
  asset: OutdoorAsset;
  image: HTMLImageElement;
  sourceFingerprint: string;
  revision: string;
  notes: ArtNote[];
  authenticated: boolean;
  close: () => void;
}) {
  const panel = useRef<HTMLElement>(null);
  const key = `outdoor:${asset.id}:${sourceFingerprint}:${revision}`,
    drafts = useWorkspace((s) => s.drafts);
  const [metadata, setMetadata] = useState<OutdoorMetadata>(() => {
      try {
        return parseOutdoorMetadata(JSON.parse(drafts[key] ?? "null"), asset.rect);
      } catch {
        return asset.metadata;
      }
    }),
    [geometry, setGeometry] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState("");
  const [tagText, setTagText] = useState(metadata.tags.join(", ")),
    [settingText, setSettingText] = useState(metadata.settings.join(", "));
  const note = drafts[`note:${key}`] ?? "";
  useEffect(() => {
    if (window.innerWidth < 1050) panel.current?.scrollIntoView({ block: "start" });
  }, []);
  useEffect(() => {
    useWorkspace.getState().setDraft(key, JSON.stringify(metadata));
  }, [key, metadata]);
  const update = (patch: Partial<OutdoorMetadata>) => {
    setMetadata({ ...metadata, ...patch });
    setSaved("");
  };
  function save(verdict: "note" | "approved" | "changes") {
    try {
      const checked = parseOutdoorMetadata(metadata, asset.rect);
      if (verdict === "changes" && !note.trim())
        throw new Error("Leave a reason for the requested changes");
      if (verdict === "approved" && (checked.colliders === null || checked.kind === "unknown"))
        throw new Error("Choose asset kind and collision behavior before approving");
      useWorkspace.getState().enqueue({
        id: crypto.randomUUID(),
        type: "asset",
        rect: asset.rect,
        fingerprint: sourceFingerprint,
        catalogRevision: revision,
        metadata: checked,
        verdict,
        note,
      });
      setError("");
      setSaved(
        verdict === "approved"
          ? "Exact metadata approval queued."
          : "Metadata and geometry queued for the shared inbox.",
      );
      useWorkspace.getState().setDraft(`note:${key}`, "");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  return (
    <aside className="asset-inspector" ref={panel}>
      <div className="card-top">
        <h2>{asset.metadata.name}</h2>
        <button type="button" onClick={close}>
          Close asset
        </button>
      </div>
      <div className="source-crop">
        <AssetThumbnail asset={asset} image={image} />
      </div>
      <p>
        <code>{asset.rect.join(", ")}</code> · {asset.evidence}
      </p>
      <Link to={`/tool/art?sheet=me-complete&rect=${asset.rect.join(",")}`}>
        Inspect source rectangle →
      </Link>
      <label>
        Asset name
        <input
          aria-label="Asset name"
          value={metadata.name}
          maxLength={160}
          onChange={(e) => update({ name: e.target.value })}
        />
      </label>
      <div className="source-toolbar">
        <label>
          Category
          <select
            aria-label="Asset category"
            value={metadata.category}
            onChange={(e) => update({ category: e.target.value as OutdoorMetadata["category"] })}
          >
            {OUTDOOR_CATEGORIES.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          Kind
          <select
            aria-label="Asset kind"
            value={metadata.kind}
            onChange={(e) => update({ kind: e.target.value as OutdoorMetadata["kind"] })}
          >
            {OUTDOOR_KINDS.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
      </div>
      <label>
        Tags (comma separated)
        <input
          aria-label="Asset tags"
          value={tagText}
          onChange={(e) => {
            setTagText(e.target.value);
            update({
              tags: e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            });
          }}
        />
      </label>
      <label>
        Settings (comma separated)
        <input
          aria-label="Asset settings"
          value={settingText}
          onChange={(e) => {
            setSettingText(e.target.value);
            update({
              settings: e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            });
          }}
        />
      </label>
      <label>
        Facing
        <select
          aria-label="Asset facing"
          value={metadata.facing}
          onChange={(e) => update({ facing: e.target.value as OutdoorMetadata["facing"] })}
        >
          {["unknown", "south", "north", "east", "west"].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </label>
      <details open={geometry} onToggle={(e) => setGeometry(e.currentTarget.open)}>
        <summary>Placement & collision geometry</summary>
        <p>
          Anchor is in source pixels. Footprint uses local ground pixels. Collider X is its center;
          Y is its bottom, relative to the anchor. Empty collision means explicitly nonblocking.
        </p>
        <Numbers
          name="Anchor"
          values={metadata.anchor}
          change={(n) => update({ anchor: n as [number, number] })}
        />
        <label>
          <input
            type="checkbox"
            checked={metadata.footprint !== null}
            onChange={(e) =>
              update({
                footprint: e.target.checked ? [-asset.rect[2] / 2, -16, asset.rect[2], 16] : null,
              })
            }
          />{" "}
          Define ground footprint
        </label>
        {metadata.footprint ? (
          <Numbers
            name="Ground footprint"
            values={metadata.footprint}
            change={(n) => update({ footprint: n as ArtRect })}
          />
        ) : null}
        <label>
          Collision behavior
          <select
            aria-label="Collision behavior"
            value={
              metadata.colliders === null
                ? "unknown"
                : metadata.colliders.length
                  ? "blocking"
                  : "nonblocking"
            }
            onChange={(e) =>
              update({
                colliders:
                  e.target.value === "unknown"
                    ? null
                    : e.target.value === "nonblocking"
                      ? []
                      : [{ offsetX: 0, offsetY: 0, width: 8, height: 8, zHeight: 16 }],
              })
            }
          >
            <option value="unknown">Unknown / not reviewed</option>
            <option value="nonblocking">Explicitly nonblocking</option>
            <option value="blocking">Custom shapes</option>
          </select>
        </label>
        {metadata.colliders?.map((c, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: Shapes are ordered controlled inputs without per-row state.
          <div className="collider-editor" key={`${i}:collider`}>
            <Numbers
              name={`Collider ${i + 1}`}
              values={[c.offsetX, c.offsetY, c.width, c.height]}
              change={(n) =>
                update({
                  colliders: metadata.colliders!.map((old, j) =>
                    j === i
                      ? { ...old, offsetX: n[0]!, offsetY: n[1]!, width: n[2]!, height: n[3]! }
                      : old,
                  ),
                })
              }
            />
            <label>
              Height
              <input
                aria-label={`Collider ${i + 1} height`}
                type="number"
                value={c.zHeight ?? ""}
                placeholder="Infinite"
                onChange={(e) =>
                  update({
                    colliders: metadata.colliders!.map((old, j) =>
                      j === i
                        ? (() => {
                            const next = { ...old };
                            if (e.target.value) next.zHeight = Number(e.target.value);
                            else delete next.zHeight;
                            return next;
                          })()
                        : old,
                    ),
                  })
                }
              />
            </label>
            <button
              type="button"
              onClick={() => update({ colliders: metadata.colliders!.filter((_, j) => i !== j) })}
            >
              Remove shape {i + 1}
            </button>
          </div>
        ))}
        <button
          type="button"
          disabled={(metadata.colliders?.length ?? 0) >= 16}
          onClick={() =>
            update({
              colliders: [
                ...(metadata.colliders ?? []),
                { offsetX: 0, offsetY: 0, width: 8, height: 8, zHeight: 16 },
              ],
            })
          }
        >
          Add collision shape
        </button>
        <label>
          Depth offset
          <input
            type="number"
            aria-label="Depth offset"
            value={metadata.depthOffset}
            onChange={(e) => update({ depthOffset: Number(e.target.value) })}
          />
        </label>
        {geometry ? <OutdoorGeometryTest asset={asset} metadata={metadata} image={image} /> : null}
      </details>
      <label>
        Metadata feedback
        <textarea
          aria-label="Metadata feedback"
          value={note}
          maxLength={3500}
          onChange={(e) => useWorkspace.getState().setDraft(`note:${key}`, e.target.value)}
        />
      </label>
      <div className="preview-controls">
        <button
          type="button"
          className="primary"
          disabled={!authenticated}
          onClick={() => save("note")}
        >
          Save correction
        </button>
        <button type="button" disabled={!authenticated} onClick={() => save("approved")}>
          Approve metadata ✓
        </button>
        <button type="button" disabled={!authenticated} onClick={() => save("changes")}>
          Needs changes ✕
        </button>
        <button
          type="button"
          onClick={() => {
            setMetadata(asset.metadata);
            setTagText(asset.metadata.tags.join(", "));
            setSettingText(asset.metadata.settings.join(", "));
            useWorkspace.getState().setDraft(key, "");
          }}
        >
          Reset metadata
        </button>
      </div>
      {!authenticated ? (
        <Link to={`/login?returnTo=${encodeURIComponent(`/tool/outdoor?asset=${asset.id}`)}`}>
          Sign in to review →
        </Link>
      ) : null}
      <ErrorMessage error={error} />
      {saved ? <p role="status">{saved}</p> : null}
      <details>
        <summary>Original names & variants ({asset.aliases.length})</summary>
        {asset.aliases.map((a) => (
          <p key={a.key}>
            <code>{a.key}</code>
          </p>
        ))}
      </details>
      <details>
        <summary>Runtime uses ({asset.runtimeTypes.length})</summary>
        {asset.runtimeTypes.map((t) => (
          <p key={t}>{t}</p>
        ))}
        {!asset.runtimeTypes.length ? (
          <p>No exact static prop match. Source workbench includes modular/terrain uses.</p>
        ) : null}
      </details>
      <details open>
        <summary>Metadata review history</summary>
        {notes.map((n) => (
          <p key={n.id}>
            <Link to={threadPath(`art:${n.threadId}`)}>
              {n.assetAnnotation?.verdict} · {n.note}
            </Link>
          </p>
        ))}
      </details>
    </aside>
  );
}
