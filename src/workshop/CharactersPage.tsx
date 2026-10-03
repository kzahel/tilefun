import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import type { ArtCatalog } from "../art/ArtCatalog.js";
import { required } from "../art/ArtCatalog.js";
import { latestArtNotes } from "../art/ArtNotes.js";
import {
  CHARACTER_FIELDS,
  CHARACTERS,
  type CharacterDefinition,
  type CharacterSettings,
  parseCharacterSettings,
} from "../characters/CharacterCatalog.js";
import { CharacterTestScene } from "../characters/CharacterTestScene.js";
import { ErrorMessage } from "./App.js";
import { buildCharacterCandidate } from "./CharacterCandidates.js";
import { useArtNotes } from "./OutdoorQueries.js";
import { candidateSummary } from "./WorkshopProjection.js";
import { useManifest } from "./WorkshopQueries.js";
import type { WorkshopCandidate, WorkshopEvent } from "./WorkshopTypes.js";
import { type ReviewQueue, useWorkspace } from "./WorkspaceStore.js";
import "./characters.css";

const emptyQueue: ReviewQueue = { filter: "all", selected: "", paused: false, batch: [] };
type CharacterEvent = Extract<WorkshopEvent, { type: "character" }>;
export default function CharactersPage() {
  const manifest = useManifest(),
    notes = useArtNotes(),
    location = useLocation(),
    navigate = useNavigate();
  const queue = useWorkspace((s) => s.queues["character-lab"]) ?? emptyQueue;
  const outbox = useWorkspace((s) => s.outbox);
  if (!manifest.data || !notes.data)
    return (
      <>
        <p role="status">Loading character reviews…</p>
        <ErrorMessage error={manifest.error ?? notes.error} />
      </>
    );
  const candidates = manifest.data.candidates.filter((c) => c.kind === "character");
  const rows = candidates.map((c) => candidateSummary(c, notes.data, [], manifest.data.current));
  const selected = new URLSearchParams(location.search).get("character") ?? "tiger";
  const def = CHARACTERS.find((c) => c.id === selected) ?? required(CHARACTERS[0]);
  const candidate = candidates.find((c) => c.characterId === def.id);
  if (!candidate)
    return <p role="alert">Character candidates are unavailable. Rebuild the Workshop manifest.</p>;
  const saved = latestArtNotes(notes.data)
    .filter(
      (n) =>
        n.characterAnnotation?.candidateId === candidate.id &&
        n.characterAnnotation.candidateFingerprint === candidate.fingerprint &&
        n.fingerprint === candidate.sourceFingerprint,
    )
    .sort((a, b) =>
      required(a.characterAnnotation).createdAt.localeCompare(
        required(b.characterAnnotation).createdAt,
      ),
    )
    .at(-1)?.characterAnnotation;
  const pending = outbox
    .filter(
      (e): e is CharacterEvent =>
        e.type === "character" &&
        e.candidateId === candidate.id &&
        e.fingerprint === candidate.fingerprint,
    )
    .at(-1);
  const state = pending
    ? pending.verdict === "note"
      ? "unchecked"
      : pending.verdict
    : rows.find((r) => r.id === candidate.id)?.state;
  function afterSave(e: CharacterEvent) {
    if (e.verdict !== "changes") return;
    const batch = [
      ...queue.batch.filter((r) => r.id !== e.candidateId),
      { id: e.candidateId, fingerprint: e.fingerprint, eventId: e.id, note: e.note },
    ];
    useWorkspace
      .getState()
      .setQueue("character-lab", { ...queue, batch, paused: batch.length >= 2 });
  }
  return (
    <section className="character-page">
      <p className="eyebrow">MOVEMENT / ALIGNMENT / COLLISION</p>
      <h1>Character lab</h1>
      <p>
        Test the authored 32px roster before adding it to the game. Walk in all four directions,
        stop, jump and try the obstacles.
      </p>
      <label>
        Character
        <select
          aria-label="Character"
          value={def.id}
          onChange={(e) => navigate(`/tool/character-lab?character=${e.target.value}`)}
        >
          {CHARACTERS.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} · {rows.find((r) => r.characterId === c.id)?.state ?? "unchecked"}
            </option>
          ))}
        </select>
      </label>
      {!manifest.data.current ? (
        <p role="alert">Review inputs changed. Rebuild the Workshop manifest before saving.</p>
      ) : null}
      {queue.paused ? (
        <div className="notice">
          <h2>Review paused after two Needs changes reports</h2>
          {queue.batch.map((r) => (
            <p key={r.eventId}>{r.note}</p>
          ))}
          <p>Tell the agent “ready” when you want these fixes implemented.</p>
          <button
            type="button"
            onClick={() =>
              useWorkspace
                .getState()
                .setQueue("character-lab", { ...queue, paused: false, batch: [] })
            }
          >
            Keep reviewing
          </button>
        </div>
      ) : null}
      <CharacterInspector
        key={`${candidate.id}:${candidate.fingerprint}`}
        def={def}
        candidate={candidate}
        baseline={pending?.settings ?? saved?.settings ?? def.defaults}
        verdict={state ?? "unchecked"}
        current={manifest.data.current}
        paused={queue.paused}
        afterSave={afterSave}
      />
    </section>
  );
}
function CharacterInspector({
  def,
  candidate,
  baseline,
  verdict,
  current,
  paused,
  afterSave,
}: {
  def: CharacterDefinition;
  candidate: WorkshopCandidate;
  baseline: CharacterSettings;
  verdict: string;
  current: boolean;
  paused: boolean;
  afterSave: (e: CharacterEvent) => void;
}) {
  const key = `character:${candidate.id}:${candidate.fingerprint}`;
  const drafts = useWorkspace((s) => s.drafts);
  const [settings, setSettings] = useState(() => {
    try {
      return parseCharacterSettings(JSON.parse(useWorkspace.getState().drafts[key] ?? "null"));
    } catch {
      return baseline;
    }
  });
  const [error, setError] = useState(""),
    [ready, setReady] = useState(false),
    [message, setMessage] = useState("");
  const [overlays, setOverlays] = useState(true),
    [zoom, setZoom] = useState(2),
    [cycle, setCycle] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null),
    scene = useRef<CharacterTestScene | null>(null);
  const keys = useRef(new Set<string>()),
    pointers = useRef(new Map<number, string>());
  const latest = useRef({ settings, overlays, zoom, cycle });
  latest.current = { settings, overlays, zoom, cycle };
  const note = drafts[`note:${key}`] ?? "";
  useEffect(() => {
    useWorkspace.getState().setDraft(key, JSON.stringify(settings));
  }, [key, settings]);
  useEffect(() => {
    scene.current?.update(settings);
    setMessage("");
  }, [settings]);
  useEffect(() => {
    let active = true,
      frame = 0;
    const release = () => {
      keys.current.clear();
      pointers.current.clear();
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    window.addEventListener("keyup", up);
    window.addEventListener("blur", release);
    document.addEventListener("visibilitychange", release);
    void (async () => {
      const response = await fetch("/tilefun/data/art-catalog.json");
      if (!response.ok) throw new Error("Character art catalog unavailable");
      const art = (await response.json()) as ArtCatalog;
      const built = await buildCharacterCandidate(def, art);
      if (built.candidate.fingerprint !== candidate.fingerprint)
        throw new Error(
          "Character preview does not match its registered review. Reload the page; if this persists, report a rendering mismatch.",
        );
      if (!active || !canvas.current) return;
      scene.current = new CharacterTestScene(
        def,
        latest.current.settings,
        built.image,
        built.player,
      );
      setReady(true);
      let last = performance.now(),
        elapsed = 0,
        accumulator = 0;
      const tick = (now: number) => {
        if (!active || !canvas.current || !scene.current) return;
        const dt = Math.min(0.1, (now - last) / 1000);
        last = now;
        accumulator += dt;
        elapsed += dt;
        const held = new Set([...keys.current, ...pointers.current.values()]);
        const dx =
          Number(held.has("arrowright") || held.has("d")) -
          Number(held.has("arrowleft") || held.has("a"));
        const dy =
          Number(held.has("arrowdown") || held.has("s")) -
          Number(held.has("arrowup") || held.has("w"));
        while (accumulator >= 1 / 60) {
          scene.current.step(
            latest.current.cycle ? 0 : dx,
            latest.current.cycle ? 0 : dy,
            held.has(" "),
            1 / 60,
          );
          accumulator -= 1 / 60;
        }
        if (latest.current.cycle) {
          const sprite = required(scene.current.actor.sprite);
          sprite.frameRow = sprite.direction = Math.floor(elapsed / 2) % 4;
          sprite.frameCol = Math.floor(elapsed * latest.current.settings.fps) % def.frameCount;
          sprite.moving = true;
        }
        scene.current.draw(canvas.current, latest.current.overlays, latest.current.zoom);
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    })().catch((e) => {
      if (active) setError(String(e));
    });
    return () => {
      active = false;
      cancelAnimationFrame(frame);
      scene.current = null;
      release();
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", release);
      document.removeEventListener("visibilitychange", release);
    };
  }, [def, candidate.fingerprint]);
  function save(verdict: CharacterEvent["verdict"]) {
    try {
      if (!ready || !current || paused) throw new Error("This candidate is not ready for review.");
      if (verdict === "changes" && !note.trim())
        throw new Error("Leave a reason for Needs changes.");
      const e: CharacterEvent = {
        id: crypto.randomUUID(),
        type: "character",
        candidateId: candidate.id,
        fingerprint: candidate.fingerprint,
        settings: parseCharacterSettings(settings),
        verdict,
        note,
      };
      useWorkspace.getState().enqueue(e);
      useWorkspace.getState().setDraft(`note:${key}`, "");
      setError("");
      setMessage("Exact art and settings queued for shared save.");
      afterSave(e);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  const edited = JSON.stringify(settings) !== JSON.stringify(baseline);
  return (
    <>
      <h2>{def.name}</h2>
      <p role="status">
        {edited ? "Draft settings · not approved" : verdict} · Proposals stay in Workshop until
        promoted.
      </p>
      <div className="character-layout">
        <div className="character-stage">
          <div className="character-scroll">
            <canvas
              ref={canvas}
              tabIndex={0}
              aria-label="Character movement test"
              onKeyDown={(e) => {
                const k = e.key.toLowerCase();
                if (
                  [
                    "arrowup",
                    "arrowdown",
                    "arrowleft",
                    "arrowright",
                    "w",
                    "a",
                    "s",
                    "d",
                    " ",
                  ].includes(k)
                ) {
                  e.preventDefault();
                  e.stopPropagation();
                  keys.current.add(k);
                }
              }}
              onBlur={() => keys.current.clear()}
            />
          </div>
          <p>
            Focus the scene: arrows / WASD to walk, Space to jump. Hold the buttons on touch
            screens. Grid: 16px.
          </p>
          <div className="character-controls">
            {[
              ["Left", "arrowleft"],
              ["Up", "arrowup"],
              ["Down", "arrowdown"],
              ["Right", "arrowright"],
              ["Jump", " "],
            ].map(([label, k]) => (
              <button
                type="button"
                key={k}
                aria-label={`Character ${label}`}
                style={{ touchAction: "none" }}
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  pointers.current.set(e.pointerId, required(k));
                }}
                onPointerUp={(e) => pointers.current.delete(e.pointerId)}
                onPointerCancel={(e) => pointers.current.delete(e.pointerId)}
                onLostPointerCapture={(e) => pointers.current.delete(e.pointerId)}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                keys.current.clear();
                pointers.current.clear();
                scene.current?.reset();
              }}
            >
              Reset position
            </button>
          </div>
          <div className="character-controls">
            <label>
              <input
                type="checkbox"
                checked={overlays}
                onChange={(e) => setOverlays(e.target.checked)}
              />{" "}
              Geometry overlays
            </label>
            <label>
              <input type="checkbox" checked={cycle} onChange={(e) => setCycle(e.target.checked)} />{" "}
              Cycle poses in place
            </label>
            <label>
              Zoom
              <select
                aria-label="Character zoom"
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
              >
                {[1, 2, 3, 4].map((z) => (
                  <option key={z}>{z}</option>
                ))}
              </select>
            </label>
          </div>
          <p>
            Blue: sprite frame · green: ground box · pink: physical height · orange: feet anchor ·
            purple: depth sorting · rust: obstacle footprints.
          </p>
          <p>
            Try the 16px passage, 4/8/12px steps and the beam with 20px clearance. Lower physical
            height to walk under the beam. Walk behind the wall to check layering.
          </p>
        </div>
        <aside className="character-settings">
          <h3>Live settings</h3>
          <p>
            Positive sprite offset moves the art down. Collider offsets move the ground box relative
            to the feet. Settings use world pixels; speed uses pixels/second.
          </p>
          <div className="character-fields">
            {CHARACTER_FIELDS.map(({ key: field, label, min, max }) => (
              <label key={field}>
                {label}
                <input
                  aria-label={label}
                  type="number"
                  min={min}
                  max={max}
                  step={1}
                  value={settings[field]}
                  onChange={(e) => {
                    const n = e.currentTarget.valueAsNumber;
                    if (Number.isFinite(n) && n >= min && n <= max)
                      setSettings((s) => ({ ...s, [field]: n }));
                  }}
                />
              </label>
            ))}
          </div>
          <button type="button" onClick={() => setSettings(def.defaults)}>
            Reset to proposal
          </button>
          <button type="button" onClick={() => setSettings(baseline)}>
            Load last saved settings
          </button>
          <label>
            Feedback
            <textarea
              aria-label="Character feedback"
              maxLength={3500}
              value={note}
              onChange={(e) => useWorkspace.getState().setDraft(`note:${key}`, e.target.value)}
            />
          </label>
          <div className="character-controls">
            <button
              type="button"
              disabled={!ready || !current || paused}
              onClick={() => save("note")}
            >
              Save settings / reopen
            </button>
            <button
              type="button"
              className="primary"
              disabled={!ready || !current || paused}
              onClick={() => save("approved")}
            >
              Approve character
            </button>
            <button
              type="button"
              disabled={!ready || !current || paused}
              onClick={() => save("changes")}
            >
              Needs changes
            </button>
          </div>
          <p>
            Approval covers this sprite sheet and the exact settings above, including all four
            directions. Editing a draft does not change a saved decision.
          </p>
          <ErrorMessage error={error} />
          {message ? <p role="status">{message}</p> : null}
        </aside>
      </div>
    </>
  );
}
