import { useEffect, useMemo, useRef, useState } from "react";
import type { ArtCatalog } from "../art/ArtCatalog.js";
import {
  LANDSCAPE_PROFILES,
  landscapeLabel,
  landscapeProfile,
} from "../generation/regional/NaturalLandscape.js";
import { CURVE_TRAIN } from "../railway/CurveTrain.js";
import { interpolatePosition, interpolateWz } from "../rendering/EntityInterpolation.js";
import {
  NATURAL_CASES,
  naturalCase,
  naturalExplorerUrl,
  naturalLandscapeRecipe,
} from "../scenarios/NaturalLandscapeRecipe.js";
import { ScenarioPresentationHost } from "../scenarios/ScenarioPresentationHost.js";
import { FROG_TYPE } from "../wildlife/Frog.js";
import { MALLARD_TYPE } from "../wildlife/Mallard.js";
import { RABBIT_TYPE } from "../wildlife/Rabbit.js";
import { ROBIN_TYPE } from "../wildlife/Robin.js";
import { buildNaturalCandidate } from "./NaturalLandscapeCandidate.js";
import { useInbox, useManifest } from "./WorkshopQueries.js";
import { useWorkspace } from "./WorkspaceStore.js";

/** Natural fixtures of the existing World geometry lab; all simulation/presentation is shared. */
export default function NaturalLandscapePage() {
  const initial = useMemo(() => new URLSearchParams(location.search), []);
  const [caseId, setCaseId] = useState(initial.get("geometry")?.replace("nature-", "") ?? "forest");
  const [profile, setProfile] = useState(
    () =>
      landscapeProfile(initial.get("landscape")) ??
      (caseId.startsWith("thicket-") ? "thicket" : "balanced"),
  );
  const [paused, setPaused] = useState(false),
    [follow, setFollow] = useState(caseId === "train");
  const [zoom, setZoom] = useState(caseId === "pond" ? 0.4 : 0.8),
    [reset, setReset] = useState(0),
    [error, setError] = useState("");
  const [ready, setReady] = useState(false),
    [verified, setVerified] = useState("");
  const [message, setMessage] = useState("");
  const canvas = useRef<HTMLCanvasElement>(null),
    host = useRef<ScenarioPresentationHost | null>(null);
  const keys = useRef(new Set<string>()),
    settings = useRef({ paused, follow, zoom });
  settings.current = { paused, follow, zoom };
  const custom = caseId === "explore";
  const point = useMemo(
    () =>
      custom
        ? {
            seed: Number(initial.get("seed") ?? 2026),
            x: Number(initial.get("x") ?? 0),
            y: Number(initial.get("y") ?? 0),
          }
        : naturalCase(caseId),
    [caseId, custom, initial],
  );
  const prepared = useMemo(() => {
    try {
      return {
        recipe: naturalLandscapeRecipe(caseId, profile, custom ? point : undefined),
        error: "",
      };
    } catch (e) {
      return { recipe: undefined, error: String(e) };
    }
  }, [caseId, profile, point, custom]);
  const manifest = useManifest(),
    inbox = useInbox();
  const candidate = manifest.data?.candidates.find(
    (c) => c.id === `nature:${caseId}:${profile}:v1`,
  );
  const noteKey = `nature-note:${candidate?.id ?? caseId}`;
  const note = useWorkspace((s) => s.drafts[noteKey] ?? "");
  const events = useWorkspace((s) => s.outbox);
  const review = events
    .filter((e) => e.type === "review" && e.candidateId === candidate?.id)
    .at(-1);
  useEffect(() => {
    let active = true;
    setVerified("");
    if (!candidate) return;
    void fetch("/tilefun/data/art-catalog.json")
      .then((r) => r.json())
      .then(async (catalog: ArtCatalog) => {
        const actual = await buildNaturalCandidate(caseId, profile, catalog);
        if (active)
          setVerified(actual.fingerprint === candidate.fingerprint ? actual.fingerprint : "");
      })
      .catch((e) => {
        if (active) setError(String(e));
      });
    return () => {
      active = false;
    };
  }, [caseId, profile, candidate]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset replaces the canvas and its Worker/renderer.
  useEffect(() => {
    const c = canvas.current,
      recipe = prepared.recipe;
    if (!c || !recipe) return;
    let active = true;
    setReady(false);
    setError("");
    setPaused(false);
    keys.current.clear();
    const h = new ScenarioPresentationHost(c, recipe, {
      width: 960,
      height: 640,
      terrain: true,
      fixedCamera: (player, alpha) => {
        const train = host.current?.session.view.entities.find((e) => e.type === CURVE_TRAIN);
        const target = settings.current.follow && train ? train : player;
        const p = interpolatePosition(target.position, target.prevPosition, alpha);
        return { wx: p.wx, wy: p.wy - (interpolateWz(target, alpha) ?? 0) - 24 };
      },
      settings: () => ({
        paused: settings.current.paused,
        zoom: settings.current.zoom,
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
      onFrame: (h) => {
        const ducks = h.session.view.entities.filter((e) => e.type === MALLARD_TYPE);
        c.dataset.wildlifeCount = String(ducks.length);
        c.dataset.wildlifePoses = JSON.stringify(
          ducks.map((e) => ({
            id: e.id,
            x: e.position.wx,
            y: e.position.wy,
            clip: e.sprite?.clip,
            frame: e.sprite?.frameCol,
            direction: e.sprite?.direction,
            z: e.wz ?? 0,
            state: e.wanderAI?.state,
          })),
        );
        const frogs = h.session.view.entities.filter((e) => e.type === FROG_TYPE);
        c.dataset.frogCount = String(frogs.length);
        c.dataset.frogPoses = JSON.stringify(
          frogs.map((e) => ({
            id: e.id,
            x: e.position.wx,
            y: e.position.wy,
            z: e.wz ?? 0,
            clip: e.sprite?.clip,
            frame: e.sprite?.frameCol,
            state: e.wanderAI?.state,
            direction: e.sprite?.direction,
          })),
        );
        const rabbits = h.session.view.entities.filter((e) => e.type === RABBIT_TYPE);
        c.dataset.rabbitCount = String(rabbits.length);
        c.dataset.rabbitPoses = JSON.stringify(
          rabbits.map((e) => ({
            id: e.id,
            x: e.position.wx,
            y: e.position.wy,
            z: e.wz ?? 0,
            clip: e.sprite?.clip,
            frame: e.sprite?.frameCol,
            state: e.wanderAI?.state,
            direction: e.sprite?.direction,
          })),
        );
        const robins = h.session.view.entities.filter((e) => e.type === ROBIN_TYPE);
        c.dataset.robinCount = String(robins.length);
        c.dataset.robinPoses = JSON.stringify(
          robins.map((e) => ({
            id: e.id,
            x: e.position.wx,
            y: e.position.wy,
            z: e.wz ?? 0,
            clip: e.sprite?.clip,
            frame: e.sprite?.frameCol,
            state: e.wanderAI?.state,
            direction: e.sprite?.direction,
          })),
        );
        const view = h.session.view;
        c.dataset.playerVz = String(view.serverPlayerEntity.jumpVZ ?? 0);
        c.dataset.playerMaxVz = String(
          Math.max(Number(c.dataset.playerMaxVz ?? 0), view.serverPlayerEntity.jumpVZ ?? 0),
        );
        c.dataset.playerZ = String(view.serverPlayerEntity.wz ?? 0);
        const diagnostics = h.getDiagnostics();
        c.dataset.authorityRunning = String(diagnostics.authority.clock?.running ?? false);
        c.dataset.terrainPending = String(diagnostics.terrain?.pending ?? -1);
        c.dataset.terrainResident = String(diagnostics.terrain?.resident ?? 0);
        const pos = view.playerEntity.position;
        const cx = Math.floor(pos.wx / 256),
          cy = Math.floor(pos.wy / 256);
        const chunk = view.world.getChunkIfLoaded(cx, cy);
        const lx = Math.floor(pos.wx / 16) - cx * 16,
          ly = Math.floor(pos.wy / 16) - cy * 16;
        c.dataset.groundBlend = String(chunk?.blendBase[ly * 16 + lx] ?? -1);

        c.dataset.trees = String(view.props.filter((p) => p.type === "prop-oak-tree").length);
        c.dataset.thicketRows = String(
          view.props.filter((p) => p.type.startsWith("pattern:forest-thicket-v1:")).length,
        );
        c.dataset.x = String(view.playerEntity.position.wx);
        c.dataset.y = String(view.playerEntity.position.wy);
        const train = view.entities.find((e) => e.type === CURVE_TRAIN);
        if (train) {
          c.dataset.trainX = String(train.position.wx);
          c.dataset.trainY = String(train.position.wy);
        }
      },
      onError: (e) => {
        if (active) {
          setError(String(e));
          setReady(false);
          delete c.dataset.ready;
        }
      },
    });
    host.current = h;
    void h.ready
      .then(() => {
        if (active) {
          setReady(true);
          c.dataset.ready = "true";
        }
      })
      .catch((e) => {
        if (active) setError(String(e));
      });
    const release = () => keys.current.clear();
    window.addEventListener("blur", release);
    return () => {
      active = false;
      h.dispose();
      host.current = null;
      keys.current.clear();
      delete c.dataset.ready;
      window.removeEventListener("blur", release);
    };
  }, [prepared, reset]);
  function change(nextCase: string, nextProfile: typeof profile) {
    setCaseId(nextCase);
    setProfile(nextProfile);
    setFollow(nextCase === "train");
    setZoom(nextCase === "pond" ? 0.4 : 0.8);
    setMessage("");
    const url = new URL(location.href);
    url.searchParams.set("geometry", `nature-${nextCase}`);
    url.searchParams.set("landscape", nextProfile);
    history.replaceState(null, "", url);
  }
  function vote(verdict: "approved" | "changes") {
    if (
      !candidate ||
      !ready ||
      verified !== candidate.fingerprint ||
      !(manifest.data?.reviewAllowed ?? manifest.data?.current)
    )
      return;
    if (verdict === "changes" && !note.trim()) {
      setMessage("Add a note describing the change you want.");
      return;
    }
    useWorkspace.getState().enqueue({
      id: crypto.randomUUID(),
      type: "review",
      candidateId: candidate.id,
      fingerprint: candidate.fingerprint,
      verdict,
      note,
    });
    useWorkspace.getState().setDraft(noteKey, "");
    setMessage("Review queued for shared save.");
  }
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
  const allowed =
    ready &&
    candidate &&
    verified === candidate.fingerprint &&
    (manifest.data?.reviewAllowed ?? manifest.data?.current);
  return (
    <section>
      <p className="eyebrow">WORLD GEOMETRY LAB · LANDSCAPE PREVIEW</p>
      <h1>Natural landscapes</h1>
      <p>
        Compare open meadows, woodland and small ponds. Extra dense adds staggered forest patterns
        with solid interiors: walk around these thickets, between them and through clearings. These
        temporary worlds leave your saved worlds unchanged.
      </p>
      <div
        className="actions"
        style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "end" }}
      >
        <label>
          Scene{" "}
          <select
            aria-label="Landscape scene"
            value={caseId}
            onChange={(e) =>
              change(e.target.value, e.target.value.startsWith("thicket-") ? "thicket" : profile)
            }
          >
            {custom && <option value="explore">Explorer location</option>}
            {NATURAL_CASES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Composition{" "}
          <select
            aria-label="Landscape composition"
            value={profile}
            onChange={(e) => change(caseId, landscapeProfile(e.target.value) ?? "balanced")}
          >
            {LANDSCAPE_PROFILES.map((p) => (
              <option key={p} value={p}>
                {landscapeLabel(p)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Zoom{" "}
          <select
            aria-label="Landscape zoom"
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
          >
            <option value={0.4}>Wide</option>
            <option value={0.8}>Normal</option>
            <option value={1.3}>Close</option>
          </select>
        </label>
        <a href={naturalExplorerUrl(point, profile)}>Regional planning overview →</a>
        <a href={naturalExplorerUrl(point, profile, 16)}>Exact tile view →</a>
      </div>
      <p>
        Seed {point.seed} · {point.x}, {point.y} tiles · Arrows/WASD to walk, Space to jump. Forest
        centers and edges use the same generator as the map.
        {profile === "thicket" &&
          " Forest rows have real collision; their cap edges and ground joins are part of this preview review."}
      </p>
      {(prepared.error || error) && <p role="alert">{prepared.error || error}</p>}
      <div
        className="geometry-stage"
        style={{ position: "relative", width: "100%", maxWidth: 960, aspectRatio: "3 / 2" }}
      >
        <canvas
          key={`${caseId}-${profile}-${reset}`}
          ref={canvas}
          width={960}
          height={640}
          tabIndex={0}
          aria-label="Natural landscape playground"
          style={{ width: "100%", height: "100%", touchAction: "none" }}
          onKeyDown={(e) => {
            if (
              ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " ", "w", "a", "s", "d"].includes(
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
      <div className="actions geometry-controls">
        {[
          ["←", "ArrowLeft"],
          ["↑", "ArrowUp"],
          ["↓", "ArrowDown"],
          ["→", "ArrowRight"],
          ["Jump", " "],
        ].map(([label, key]) => (
          <button
            type="button"
            key={key}
            {...touch(key ?? "")}
            onContextMenu={(e) => e.preventDefault()}
          >
            {label}
          </button>
        ))}
        <button type="button" onClick={() => setPaused(!paused)}>
          {paused ? "Resume" : "Pause"}
        </button>
        <button type="button" onClick={() => setReset(reset + 1)}>
          Reset scene
        </button>
        <button
          type="button"
          disabled={!ready}
          onClick={() => {
            void host.current?.session
              .reload()
              .then(() => {
                if (canvas.current)
                  canvas.current.dataset.reloadCount = String(
                    Number(canvas.current.dataset.reloadCount ?? 0) + 1,
                  );
              })
              .catch((e) => setError(String(e)));
          }}
        >
          Save / reload scene
        </button>
        {caseId === "train" && (
          <>
            <button
              type="button"
              onClick={() => {
                setFollow(true);
                void host.current
                  ?.command({ kind: "train-position", roof: true })
                  .catch((e) => setError(String(e)));
                canvas.current?.focus();
              }}
            >
              Ride train roof
            </button>
            <button type="button" onClick={() => setFollow(!follow)}>
              {follow ? "Follow player" : "Follow train"}
            </button>
          </>
        )}
        {(caseId === "robins"
          ? [{ type: ROBIN_TYPE, label: "robin" }]
          : caseId === "rabbits"
            ? [{ type: RABBIT_TYPE, label: "rabbit" }]
            : caseId === "pond" || caseId === "frogs"
              ? [
                  { type: MALLARD_TYPE, label: "duck" },
                  { type: FROG_TYPE, label: "frog" },
                ]
              : []
        ).map((animal) => (
          <button
            key={animal.type}
            type="button"
            disabled={!ready || paused}
            onClick={() => {
              const h = host.current;
              const target = h?.session.view.entities.find(
                (e) =>
                  e.type === animal.type && e.wanderAI?.state !== "scared" && (e.wz ?? 0) === 0,
              );
              if (!h || !target) return;
              if (canvas.current) canvas.current.dataset.playerMaxVz = "0";
              void h
                .command({
                  kind: "teleport",
                  position: { ...target.position },
                  z: (target.wz ?? 0) + 26,
                })
                .catch((e) => setError(String(e)));
              canvas.current?.focus();
            }}
          >
            Hop onto {animal.label}
          </button>
        ))}
      </div>
      <p role="status">{ready ? "Ready to explore" : "Preparing landscape…"}</p>
      {candidate && (
        <div>
          <p>
            Review this scene and composition ·{" "}
            {review?.type === "review"
              ? review.verdict
              : (inbox.data?.candidates.find((c) => c.id === candidate.id)?.state ?? "unchecked")}
          </p>
          <label>
            Review note
            <textarea
              aria-label="Landscape review note"
              value={note}
              onChange={(e) => useWorkspace.getState().setDraft(noteKey, e.target.value)}
            />
          </label>
          <div className="actions">
            <button type="button" disabled={!allowed} onClick={() => vote("approved")}>
              Looks good
            </button>
            <button type="button" disabled={!allowed} onClick={() => vote("changes")}>
              Needs changes
            </button>
          </div>
          <p role="status">
            {message || (!verified ? "Checking the registered composition…" : "")}
          </p>
        </div>
      )}
      <p>
        <a href="/tilefun/workshop.html#/tool/families?family=trees">
          Tree and forest source patterns →
        </a>{" "}
        ·{" "}
        <a href="/tilefun/workshop.html?geometry=deck#/tool/world-geometry">
          Ramps and raised terrain →
        </a>
      </p>
    </section>
  );
}
