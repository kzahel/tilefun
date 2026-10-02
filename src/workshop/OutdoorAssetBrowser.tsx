import { useEffect, useRef, useState } from "react";
import { OUTDOOR_CATEGORIES, type OutdoorAsset } from "../assets/outdoor/OutdoorCatalog.js";
export function AssetThumbnail({ asset, image }: { asset: OutdoorAsset; image: HTMLImageElement }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const [, , w, h] = asset.rect,
      scale = Math.min(3, 96 / w, 96 / h);
    c.width = Math.max(1, Math.round(w * scale));
    c.height = Math.max(1, Math.round(h * scale));
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, ...asset.rect, 0, 0, c.width, c.height);
  }, [asset.rect, image]);
  return <canvas ref={ref} aria-label={asset.metadata.name} />;
}
export const assetFamily = (a: OutdoorAsset) =>
  `${a.metadata.category}:${a.metadata.name
    .replace(/\b\d+\b/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()}`;
export function OutdoorAssetBrowser({
  assets,
  image,
  onSelect,
  initialSetting = "",
  selectedId,
  reviewStates = {},
}: {
  assets: OutdoorAsset[];
  image: HTMLImageElement;
  onSelect: (asset: OutdoorAsset) => void;
  initialSetting?: string;
  selectedId?: string | undefined;
  reviewStates?: Record<string, string>;
}) {
  const [search, setSearch] = useState(""),
    [category, setCategory] = useState("all"),
    [setting, setSetting] = useState(initialSetting),
    [status, setStatus] = useState("all"),
    [family, setFamily] = useState(""),
    [page, setPage] = useState(0),
    [grouped, setGrouped] = useState(true);
  const matching = assets
    .filter(
      (a) =>
        (!search ||
          `${a.metadata.name} ${a.metadata.tags.join(" ")} ${a.aliases.map((s) => s.key).join(" ")}`
            .toLowerCase()
            .includes(search.toLowerCase())) &&
        (category === "all" || category === a.metadata.category) &&
        (!setting || a.metadata.settings.includes(setting)) &&
        (status === "all" ||
          (status === "unknown"
            ? a.metadata.colliders === null
            : status === "runtime"
              ? a.runtimeTypes.length > 0
              : status === "unreviewed"
                ? !reviewStates[a.id] || reviewStates[a.id] === "note"
                : reviewStates[a.id] === status)) &&
        (!family || assetFamily(a) === family),
    )
    .sort(
      (a, b) =>
        Number(b.evidence === "candidate") - Number(a.evidence === "candidate") ||
        a.metadata.name.localeCompare(b.metadata.name),
    );
  const groups = new Map<string, OutdoorAsset[]>();
  for (const a of matching) {
    const k = assetFamily(a);
    groups.set(k, [...(groups.get(k) ?? []), a]);
  }
  const list = grouped && !family ? [...groups.values()].map((g) => g[0]!) : matching;
  const visible = list.slice(page * 48, (page + 1) * 48);
  const selectedIndex = matching.findIndex((a) => a.id === selectedId);
  const reset = () => {
    setPage(0);
    setFamily("");
  };
  return (
    <div className="outdoor-browser">
      {selectedIndex >= 0 ? (
        <div className="filter-row selected-asset-navigation">
          <button
            type="button"
            disabled={selectedIndex <= 0}
            onClick={() => {
              const a = matching[selectedIndex - 1];
              if (a) onSelect(a);
            }}
          >
            ← Previous asset
          </button>
          <span>
            {selectedIndex + 1}/{matching.length}
          </span>
          <button
            type="button"
            disabled={selectedIndex >= matching.length - 1}
            onClick={() => {
              const a = matching[selectedIndex + 1];
              if (a) onSelect(a);
            }}
          >
            Next asset →
          </button>
        </div>
      ) : null}
      <div className="source-toolbar">
        <label>
          Search assets
          <input
            aria-label="Search outdoor assets"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              reset();
            }}
            placeholder="Tables, shade, trees, market…"
          />
        </label>
        <label>
          Category
          <select
            aria-label="Asset category filter"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              reset();
            }}
          >
            <option value="all">All categories</option>
            {OUTDOOR_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          Setting
          <select
            aria-label="Asset setting filter"
            value={setting}
            onChange={(e) => {
              setSetting(e.target.value);
              reset();
            }}
          >
            <option value="">Any setting</option>
            {[...new Set(assets.flatMap((a) => a.metadata.settings))].sort().map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label>
          Review
          <select
            aria-label="Asset review filter"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              reset();
            }}
          >
            <option value="all">All assets</option>
            <option value="unreviewed">Unreviewed metadata</option>
            <option value="unknown">Unknown collision</option>
            <option value="approved">Approved metadata</option>
            <option value="changes">Needs changes</option>
            <option value="changed">Changed definition / review again</option>
            <option value="runtime">Used by runtime props</option>
          </select>
        </label>
      </div>
      <div className="filter-row">
        <label>
          <input
            type="checkbox"
            checked={grouped}
            onChange={(e) => {
              setGrouped(e.target.checked);
              setPage(0);
            }}
          />{" "}
          Group variants
        </label>
        {family ? (
          <button
            type="button"
            onClick={() => {
              setFamily("");
              setPage(0);
            }}
          >
            ← All families
          </button>
        ) : null}
        <span>
          {matching.length} assets · {list.length} {grouped && !family ? "families" : "results"}
        </span>
      </div>
      <div className="outdoor-grid">
        {visible.map((a) => (
          <article key={a.id} className={a.id === selectedId ? "selected" : ""}>
            <button type="button" className="asset-thumb" onClick={() => onSelect(a)}>
              <AssetThumbnail asset={a} image={image} />
              <strong>{a.metadata.name}</strong>
            </button>
            <small>
              {a.metadata.category} · {reviewStates[a.id] ?? a.evidence}
              {a.metadata.colliders === null ? " · geometry unknown" : ""}
            </small>
            {grouped && !family && (groups.get(assetFamily(a))?.length ?? 0) > 1 ? (
              <button
                type="button"
                onClick={() => {
                  setFamily(assetFamily(a));
                  setPage(0);
                }}
              >
                {groups.get(assetFamily(a))?.length} variants →
              </button>
            ) : null}
          </article>
        ))}
      </div>
      {!list.length ? <p>No assets match. Try another setting, category or search.</p> : null}
      <div className="filter-row">
        <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>
          ← Previous assets
        </button>
        <span>
          {page + 1}/{Math.max(1, Math.ceil(list.length / 48))}
        </span>
        <button
          type="button"
          disabled={(page + 1) * 48 >= list.length}
          onClick={() => setPage(page + 1)}
        >
          Next assets →
        </button>
      </div>
    </div>
  );
}
