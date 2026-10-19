import { useEffect, useMemo, useRef, useState } from "react";
import { ANIMAL_BROWSER_ENTRIES, type AnimalBrowserEntry } from "./AnimalBrowserData.js";
import retainedDates from "./animal-browser-dates.json";

const dates: Record<string, { added: string | null; updated: string | null }> = retainedDates;
const images = new Map<string, Promise<HTMLImageElement>>();
function imageFor(path: string) {
  let pending = images.get(path);
  if (!pending) {
    const image = new Image();
    image.src = `${import.meta.env.BASE_URL}${path}`;
    pending = image.decode().then(() => image);
    images.set(path, pending);
  }
  return pending;
}
function AnimalPreview({
  animal,
  motion,
  direction,
  animate,
}: {
  animal: AnimalBrowserEntry;
  motion: string;
  direction: number;
  animate: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let disposed = false,
      visible = false,
      request = 0,
      start = performance.now(),
      image: HTMLImageElement | undefined;
    canvas.dataset.ready = "false";
    const def = animal.sprite,
      clip =
        (motion === "walk"
          ? animal.locomotion
          : motion === "action"
            ? animal.action
            : def.clips?.find((c) => c.name === motion)) ?? def.clips?.[0];
    const count = clip?.count ?? def.frameCount,
      duration = clip?.frameDuration ?? def.frameDuration,
      first = clip?.start ?? 0;
    let crop = { x: 0, y: 0, w: def.spriteWidth, h: def.spriteHeight };
    const draw = () => {
      if (disposed || !visible || !image) return;
      const index = animate ? Math.floor((performance.now() - start) / duration) % count : 0;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = false;
      const scale =
        Math.min(
          4,
          Math.floor(Math.min(canvas.width / (crop.w + 8), canvas.height / (crop.h + 8))),
        ) || 1;
      const w = crop.w * scale,
        h = crop.h * scale;
      ctx.drawImage(
        image,
        (first + index) * def.spriteWidth + crop.x,
        direction * def.spriteHeight + crop.y,
        crop.w,
        crop.h,
        Math.floor((canvas.width - w) / 2),
        Math.floor((canvas.height - h) / 2),
        w,
        h,
      );
      canvas.dataset.clip = clip?.name ?? "default";
      canvas.dataset.ready = "true";
      canvas.dataset.frame = String(index);
      if (animate) request = requestAnimationFrame(draw);
    };
    let loading = false;
    const load = () => {
      if (loading) return;
      loading = true;
      void imageFor(animal.image)
        .then((loaded) => {
          if (disposed) return;
          image = loaded;
          // Fit the union of the authored clip so arms and feet stay in frame.
          const probe = document.createElement("canvas");
          probe.width = def.spriteWidth;
          probe.height = def.spriteHeight;
          const ctx = probe.getContext("2d", { willReadFrequently: true });
          if (ctx) {
            let left = probe.width,
              top = probe.height,
              right = 0,
              bottom = 0;
            for (let i = 0; i < count; i++) {
              ctx.clearRect(0, 0, probe.width, probe.height);
              ctx.drawImage(
                loaded,
                (first + i) * probe.width,
                direction * probe.height,
                probe.width,
                probe.height,
                0,
                0,
                probe.width,
                probe.height,
              );
              const pixels = ctx.getImageData(0, 0, probe.width, probe.height).data;
              for (let y = 0; y < probe.height; y++)
                for (let x = 0; x < probe.width; x++)
                  if (pixels[(y * probe.width + x) * 4 + 3]) {
                    left = Math.min(left, x);
                    right = Math.max(right, x + 1);
                    top = Math.min(top, y);
                    bottom = Math.max(bottom, y + 1);
                  }
            }
            if (right > left && bottom > top)
              crop = { x: left, y: top, w: right - left, h: bottom - top };
          }
          cancelAnimationFrame(request);
          draw();
        })
        .catch(() => {
          if (!disposed) setFailed(true);
        });
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false;
      cancelAnimationFrame(request);
      if (visible) {
        start = performance.now();
        load();
        draw();
      }
    });
    observer.observe(canvas);
    return () => {
      disposed = true;
      observer.disconnect();
      cancelAnimationFrame(request);
    };
  }, [animal, motion, direction, animate]);
  return failed ? (
    <p>Preview unavailable</p>
  ) : (
    <canvas
      ref={ref}
      width={192}
      height={128}
      role="img"
      aria-label={`${animal.name} animation`}
      style={{
        width: "100%",
        maxWidth: 240,
        height: 128,
        objectFit: "contain",
        imageRendering: "pixelated",
        background: "#a8b9a0",
        borderRadius: 8,
      }}
    />
  );
}

export default function AnimalBrowser({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (scene: string) => void;
}) {
  const [search, setSearch] = useState(""),
    [family, setFamily] = useState("all"),
    [sort, setSort] = useState("newest"),
    [motion, setMotion] = useState("walk"),
    [direction, setDirection] = useState(2);
  const [animate, setAnimate] = useState(
    () => !matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const families = useMemo(
    () => [...new Set(ANIMAL_BROWSER_ENTRIES.map((a) => a.family))].sort(),
    [],
  );
  const rows = useMemo(
    () =>
      ANIMAL_BROWSER_ENTRIES.filter(
        (a) =>
          (family === "all" || a.family === family) &&
          `${a.name} ${a.id} ${a.family}`.toLowerCase().includes(search.trim().toLowerCase()),
      ).sort((a, b) => {
        if (sort === "family")
          return a.family.localeCompare(b.family) || a.name.localeCompare(b.name);
        if (sort === "name") return a.name.localeCompare(b.name);
        const key = sort === "updated" ? "updated" : "added",
          ad = dates[a.id]?.[key],
          bd = dates[b.id]?.[key];
        if (!ad || !bd) return Number(!ad) - Number(!bd) || a.name.localeCompare(b.name);
        return (
          (sort === "oldest" ? ad.localeCompare(bd) : bd.localeCompare(ad)) ||
          a.name.localeCompare(b.name)
        );
      }),
    [search, family, sort],
  );
  return (
    <details open className="animal-browser" style={{ margin: "16px 0" }}>
      <summary>
        <strong>Animal browser</strong> · {ANIMAL_BROWSER_ENTRIES.length} playable animals and coat
        variants
      </summary>
      <p>Browse their animations, then watch the selected animal in the playground below.</p>
      <div className="actions" style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        <label>
          Find animal{" "}
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name or family"
          />
        </label>
        <label>
          Family{" "}
          <select
            aria-label="Animal family"
            value={family}
            onChange={(e) => setFamily(e.target.value)}
          >
            <option value="all">All families</option>
            {families.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </label>
        <label>
          Sort{" "}
          <select aria-label="Sort animals" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="newest">Newest added</option>
            <option value="updated">Recently updated</option>
            <option value="oldest">Oldest added</option>
            <option value="name">Name A–Z</option>
            <option value="family">Family</option>
          </select>
        </label>
        <label>
          Animation{" "}
          <select
            aria-label="Preview animation"
            value={motion}
            onChange={(e) => setMotion(e.target.value)}
          >
            <option value="walk">Locomotion</option>
            <option value="idle">Idle</option>
            <option value="action">Action</option>
          </select>
        </label>
        <label>
          Facing{" "}
          <select
            aria-label="Preview facing"
            value={direction}
            onChange={(e) => setDirection(Number(e.target.value))}
          >
            <option value={0}>Front</option>
            <option value={1}>Back</option>
            <option value={2}>Left</option>
            <option value={3}>Right</option>
          </select>
        </label>
        <label>
          <input type="checkbox" checked={animate} onChange={(e) => setAnimate(e.target.checked)} />{" "}
          Animate previews
        </label>
      </div>
      <p role="status">{rows.length} animals shown</p>
      <section
        aria-label="Animal results"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill,minmax(190px,1fr))",
          gap: 12,
          maxHeight: 460,
          overflowY: "auto",
          padding: 4,
        }}
      >
        {rows.map((a) => (
          <article
            key={a.id}
            data-animal={a.id}
            style={{
              border: a.scene === selected ? "2px solid #ddba67" : "1px solid #6c7972",
              borderRadius: 10,
              padding: 12,
            }}
          >
            <AnimalPreview animal={a} motion={motion} direction={direction} animate={animate} />
            <h3 style={{ margin: "8px 0 4px" }}>{a.name}</h3>
            <p style={{ margin: "4px 0" }}>
              {a.family} · {a.companion ? "Companion" : a.hunter ? "Hunting" : "Wildlife"}
            </p>
            <small>
              {dates[a.id]?.added ? (
                <>
                  Added{" "}
                  <time dateTime={dates[a.id]?.added ?? undefined}>
                    {dates[a.id]?.added?.slice(0, 10)}
                  </time>
                </>
              ) : (
                "Addition date unavailable"
              )}
              {dates[a.id]?.updated && <> · Updated {dates[a.id]?.updated?.slice(0, 10)}</>}
            </small>
            <p>
              <button type="button" onClick={() => onSelect(a.scene)}>
                {a.scene === selected ? "Watch again" : "Watch AI"}
              </button>
            </p>
          </article>
        ))}
      </section>
      {!rows.length && <p>No animals match. Try another name or family.</p>}
    </details>
  );
}
