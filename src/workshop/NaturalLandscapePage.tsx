import { useEffect, useMemo, useRef, useState } from "react";
import type { ArtCatalog } from "../art/ArtCatalog.js";
import { AudioManager } from "../audio/AudioManager.js";
import { FootstepSystem } from "../audio/FootstepSystem.js";
import { buildFootstepManifest } from "../audio/SurfaceType.js";
import { isBoat } from "../boats/Boat.js";
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
import { DEER_TYPE } from "../wildlife/Deer.js";
import { FAUNA_PROFILES, faunaProfile, faunaType } from "../wildlife/Fauna.js";
import { FIERCE_DENS } from "../wildlife/FierceDens.js";
import { creatureSpecies, FOOD_WEB } from "../wildlife/FoodWeb.js";
import { FROG_TYPE } from "../wildlife/Frog.js";
import { MALLARD_TYPE } from "../wildlife/Mallard.js";
import { PREDATOR_PROFILES, predatorType } from "../wildlife/Predator.js";
import { RABBIT_TYPE } from "../wildlife/Rabbit.js";
import { ROBIN_TYPE } from "../wildlife/Robin.js";
import AnimalBrowser from "./AnimalBrowser.js";
import { ANIMAL_BROWSER_ENTRIES } from "./AnimalBrowserData.js";
import { buildNaturalCandidate } from "./NaturalLandscapeCandidate.js";
import { useInbox, useManifest } from "./WorkshopQueries.js";
import { useWorkspace } from "./WorkspaceStore.js";

function animalInspectionZoom(id: string): number | undefined {
  if (["behavior-cow", "behavior-sheep"].includes(id)) return 2;
  if (id === "behavior-donkey") return 2.2;
  if (id === "behavior-horse") return 1.6;
  if (id === "behavior-giraffe") return 0.9;
  if (id === "behavior-beaver") return 1.8;
  if (id === "behavior-bee") return 2.5;
  if (id === "behavior-chicken" || id === "behavior-hummingbird") return 2;
  if (id === "behavior-goat") return 1.3;
  if (id === "behavior-pig") return 1.6;
  if (id === "behavior-elephant") return 0.9;
  if (id === "behavior-capuchin" || id === "behavior-raccoon") return 1;
  if (id.startsWith("behavior-cat")) return 1.4;
  if (id === "behavior-rabbit") return 2;
  if (id === "behavior-robin") return 1;
  if (id === "behavior-meerkat") return 1.4;
  return (
    FAUNA_PROFILES.find((p) => p.species === id)?.inspectionZoom ??
    (PREDATOR_PROFILES.find((p) => p.species === id)?.expansion?.habitat === "deep"
      ? 0.4
      : undefined)
  );
}

/** Natural fixtures of the existing World geometry lab; all simulation/presentation is shared. */
export default function NaturalLandscapePage() {
  const initial = useMemo(() => new URLSearchParams(location.search), []);
  const [caseId, setCaseId] = useState(initial.get("geometry")?.replace("nature-", "") ?? "forest");
  const [profile, setProfile] = useState(
    () =>
      landscapeProfile(initial.get("landscape")) ??
      (caseId.startsWith("thicket-") ? "thicket" : "balanced"),
  );
  const [watchAnimal, setWatchAnimal] = useState(() =>
    ANIMAL_BROWSER_ENTRIES.some((a) => a.scene === caseId),
  );
  const [paused, setPaused] = useState(false),
    [follow, setFollow] = useState(caseId === "train");
  const [sounds, setSounds] = useState(false);
  const audio = useRef<AudioManager | null>(null),
    footsteps = useRef<FootstepSystem | null>(null);
  const audioTime = useRef(0);
  useEffect(() => () => audio.current?.dispose(), []);
  const [zoom, setZoom] = useState(
      animalInspectionZoom(caseId) ??
        (caseId === "racetrack"
          ? 0.13
          : caseId === "farmstead"
            ? 0.25
            : ["village-pets", "city-pets", "city-center"].includes(caseId)
              ? 0.3
              : ["pond", "lake"].includes(caseId)
                ? 0.4
                : 0.8),
    ),
    [reset, setReset] = useState(0),
    [error, setError] = useState("");
  const [ready, setReady] = useState(false),
    [verified, setVerified] = useState("");
  const [message, setMessage] = useState("");
  const canvas = useRef<HTMLCanvasElement>(null),
    host = useRef<ScenarioPresentationHost | null>(null);
  const keys = useRef(new Set<string>()),
    settings = useRef({ paused, follow, zoom, sounds, watchAnimal });
  settings.current = { paused, follow, zoom, sounds, watchAnimal };
  const custom = caseId === "explore";
  const predatorCase =
    PREDATOR_PROFILES.some((p) => p.species === caseId) ||
    ["wolf-pack", "food-web-natural", "food-web-placed"].includes(caseId);
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
      ...(["racetrack", "lake"].includes(caseId) ? { defaultRenderer: "gpu-mesh" as const } : {}),
      width: 960,
      height: 640,
      terrain: true,
      fixedCamera: (player, alpha) => {
        if (["behavior-cow", "behavior-sheep", "behavior-donkey"].includes(caseId))
          return { wx: 160, wy: 164 };
        if (caseId === "behavior-horse") return { wx: 160, wy: 176 };
        if (caseId === "behavior-giraffe") return { wx: 176, wy: 104 };
        if (caseId === "behavior-beaver") return { wx: 144, wy: 186 };
        if (caseId === "behavior-goat") return { wx: 144, wy: 144 };
        if (caseId === "behavior-pig") return { wx: 152, wy: 152 };
        if (caseId === "behavior-elephant") return { wx: 176, wy: 112 };
        if (caseId === "behavior-capuchin") return { wx: 160, wy: 100 };
        if (caseId === "behavior-raccoon") return { wx: 160, wy: 128 };
        if (caseId === "behavior-rabbit") return { wx: 160, wy: 176 };
        // Include the elevated tree crown and the ground food in the same view.
        if (caseId === "behavior-robin") return { wx: 144, wy: 112 };
        if (caseId === "behavior-meerkat") return { wx: 164, wy: 176 };
        if (caseId.startsWith("behavior-")) return { wx: 160, wy: 144 };
        const train = host.current?.session.view.entities.find((e) => e.type === CURVE_TRAIN);
        const watched = settings.current.watchAnimal
          ? ANIMAL_BROWSER_ENTRIES.find((a) => a.scene === caseId)
          : undefined;
        const animal = watched
          ? host.current?.session.view.entities.find((e) => e.type === watched.type)
          : undefined;
        const target = animal ?? (settings.current.follow && train ? train : player);
        const p = interpolatePosition(target.position, target.prevPosition, alpha);
        const selected = FAUNA_PROFILES.find((p) => p.species === caseId);
        const ray =
          selected?.habitat === "deep"
            ? host.current?.session.view.entities.find(
                (e) => e.type === faunaType(selected.species),
              )
            : undefined;
        if (ray) {
          const q = interpolatePosition(ray.position, ray.prevPosition, alpha);
          return {
            wx: (p.wx + q.wx) / 2,
            wy:
              (p.wy +
                q.wy -
                (interpolateWz(target, alpha) ?? 0) -
                (interpolateWz(ray, alpha) ?? 0)) /
                2 -
              24,
          };
        }
        return {
          wx: p.wx,
          wy: p.wy - (interpolateWz(target, alpha) ?? 0) - (caseId === "racetrack" ? 37 * 16 : 24),
        };
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
        sprinting: keys.current.has("Shift"),
        reversing: keys.current.has("r"),
      }),
      onFrame: (h) => {
        const sound = audio.current,
          viewForAudio = h.session.view;
        if (sound) {
          const enabled = settings.current.sounds && !settings.current.paused && !document.hidden;
          sound.updateCreatureCalls(
            viewForAudio.entities,
            viewForAudio.playerEntity.position,
            enabled,
          );
          footsteps.current ??= new FootstepSystem(
            sound,
            () => h.session.view.world,
            () => h.camera,
            () => h.session.view.playerEntity,
            () => h.session.view.props,
          );
          const now = performance.now();
          if (enabled && audioTime.current)
            footsteps.current.update(
              Math.min(0.1, (now - audioTime.current) / 1000),
              viewForAudio.entities,
            );
          audioTime.current = now;
          c.dataset.creatureCalls = String(sound.creatureAudioDiagnostics.played);
        }
        c.dataset.foodWebActors = JSON.stringify(
          h.session.view.entities
            .filter((e) => creatureSpecies(e))
            .map((e) => ({ id: e.id, type: e.type })),
        );
        c.dataset.predatorPoses = JSON.stringify(
          h.session.view.entities
            .filter((e) => PREDATOR_PROFILES.some((p) => predatorType(p.species) === e.type))
            .map((e) => ({
              id: e.id,
              type: e.type,
              x: e.position.wx,
              y: e.position.wy,
              z: e.wz ?? 0,
              clip: e.sprite?.clip,
              frame: e.sprite?.frameCol,
              state: e.wanderAI?.state,
            })),
        );
        c.dataset.fierceDens = JSON.stringify(
          h.session.view.props
            .filter((p) => FIERCE_DENS.some((d) => d.type === p.type))
            .map((p) => ({ type: p.type, x: p.position.wx, y: p.position.wy })),
        );
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
        const fauna = h.session.view.entities.filter((e) => faunaProfile(e.type));
        c.dataset.faunaPoses = JSON.stringify(
          fauna.map((e) => {
            const p = faunaProfile(e.type);
            const point = h.camera.worldToScreen(e.position.wx, e.position.wy - (e.wz ?? 0));
            const scale = h.camera.scale;
            const visible =
              !!p &&
              point.sx - (p.size / 2) * scale >= 0 &&
              point.sx + (p.size / 2) * scale <= h.camera.viewportWidth &&
              point.sy - p.anchor[1] * scale >= 0 &&
              point.sy + (p.size - p.anchor[1]) * scale <= h.camera.viewportHeight;
            return {
              visible,
              id: e.id,
              species: faunaProfile(e.type)?.species,
              x: e.position.wx,
              y: e.position.wy,
              z: e.wz ?? 0,
              clip: e.sprite?.clip,
              frame: e.sprite?.frameCol,
              state: e.wanderAI?.state,
            };
          }),
        );
        const deer = h.session.view.entities.filter((e) => e.type === DEER_TYPE);
        c.dataset.deerCount = String(deer.length);
        c.dataset.deerPoses = JSON.stringify(
          deer.map((e) => ({
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
        if (caseId === "racetrack") {
          const racers = new Map(
            Object.entries(h.session.handles)
              .filter(([key]) => key.startsWith("racer:"))
              .map(([key, id]) => [id, key]),
          );
          c.dataset.racerPoses = JSON.stringify(
            view.entities
              .filter((e) => racers.has(e.id))
              .map((e) => ({
                key: racers.get(e.id),
                id: e.id,
                x: e.position.wx,
                y: e.position.wy,
                vx: e.velocity?.vx,
                vy: e.velocity?.vy,
              })),
          );
          c.dataset.spectatorCount = String(
            view.entities.filter(
              (e) =>
                e.type.startsWith("person") &&
                Math.abs(e.position.wx / 16 - point.x) <= 64 &&
                Math.abs(e.position.wy / 16 - point.y) <= 52,
            ).length,
          );
        }
        c.dataset.cityBuildingCount = String(
          view.props.filter((p) => p.type.startsWith("prop-city-dense-v1-")).length,
        );
        c.dataset.cityWalkerCount = String(
          view.entities.filter((e) => e.type.startsWith("person")).length,
        );
        c.dataset.farmHouseCount = String(
          view.props.filter(
            (p) => p.proceduralId?.startsWith("farmstead:") && p.type === "prop-country-house",
          ).length,
        );
        c.dataset.petCount = String(
          fauna.filter((e) => {
            const p = faunaProfile(e.type);
            return ["cat", "dog"].includes(p?.variantOf ?? p?.species ?? "");
          }).length,
        );
        c.dataset.playerVz = String(view.serverPlayerEntity.jumpVZ ?? 0);
        c.dataset.playerMaxVz = String(
          Math.max(Number(c.dataset.playerMaxVz ?? 0), view.serverPlayerEntity.jumpVZ ?? 0),
        );
        c.dataset.playerZ = String(view.serverPlayerEntity.wz ?? 0);
        c.dataset.workActors = JSON.stringify(
          view.serverEntities
            .filter((e) => e.type.includes("wildlife-") || e.type === "ball")
            .map((e) => {
              const p = h.camera.worldToScreen(e.position.wx, e.position.wy - (e.wz ?? 0));
              const sprite = e.sprite,
                scale = h.camera.scale;
              const bottom = p.sy + (sprite?.drawOffsetY ?? 0) * scale;
              const visible =
                !!sprite &&
                p.sx - (sprite.spriteWidth / 2) * scale >= 0 &&
                p.sx + (sprite.spriteWidth / 2) * scale <= h.camera.viewportWidth &&
                bottom - sprite.spriteHeight * scale >= 0 &&
                bottom <= h.camera.viewportHeight;
              return {
                id: e.id,
                type: e.type,
                x: e.position.wx,
                y: e.position.wy,
                z: e.wz ?? 0,
                clip: e.sprite?.clip,
                column: e.sprite?.frameCol,
                row: e.sprite?.frameRow,
                screen: {
                  left: p.sx - ((sprite?.spriteWidth ?? 0) / 2) * scale,
                  top: bottom - (sprite?.spriteHeight ?? 0) * scale,
                  width: (sprite?.spriteWidth ?? 0) * scale,
                  height: (sprite?.spriteHeight ?? 0) * scale,
                },
                parent: e.parentId ?? -1,
                visible,
              };
            }),
        );
        c.dataset.playerParent = String(view.serverPlayerEntity.parentId ?? -1);
        c.dataset.boatPoses = JSON.stringify(
          view.serverEntities.filter(isBoat).map((e) => ({
            id: e.id,
            x: e.position.wx,
            y: e.position.wy,
            z: e.wz ?? 0,
            heading: e.vehicleHeading,
          })),
        );
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
      audio.current?.stopCreatureCalls();
      footsteps.current = null;
      audioTime.current = 0;
      host.current = null;
      keys.current.clear();
      delete c.dataset.ready;
      window.removeEventListener("blur", release);
    };
  }, [prepared, reset]);
  function change(nextCase: string, nextProfile: typeof profile) {
    setWatchAnimal(ANIMAL_BROWSER_ENTRIES.some((a) => a.scene === nextCase));
    setCaseId(nextCase);
    setProfile(nextProfile);
    setFollow(nextCase === "train");
    setZoom(
      animalInspectionZoom(nextCase) ??
        (nextCase === "racetrack"
          ? 0.13
          : nextCase === "farmstead"
            ? 0.25
            : ["village-pets", "city-pets", "city-center"].includes(nextCase)
              ? 0.3
              : ["pond", "lake"].includes(nextCase)
                ? 0.4
                : 0.8),
    );
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
        Explore connected farmsteads, village greens and city neighborhoods alongside meadows,
        woodland and ponds. Extra dense adds staggered forest patterns with solid interiors: walk
        around these thickets, between them and through clearings. These temporary worlds leave your
        saved worlds unchanged.
      </p>
      <AnimalBrowser
        selected={caseId}
        onSelect={(scene) => {
          if (scene === caseId) setReset(reset + 1);
          change(scene, "thicket");
          requestAnimationFrame(() =>
            canvas.current?.scrollIntoView({ block: "center", behavior: "smooth" }),
          );
        }}
      />
      {caseId.startsWith("behavior-") && (
        <div className="actions">
          <p>
            {caseId === "behavior-cow"
              ? "The cow grazes a real grass portion, lies down to chew its meal, then stands. Grass slowly regrows during active play."
              : caseId === "behavior-sheep"
                ? "Separated sheep walk back toward their flock and bleat when reunited. Following companions stay under your control."
                : caseId === "behavior-donkey"
                  ? "The donkey lies down and rolls on a dust patch, then rises. Each completed bath leaves lasting scuffs on the patch."
                  : caseId === "behavior-horse"
                    ? "The horse lowers its head to graze real grass, then drinks from a spring pool. Depleted grass and water slowly replenish during active play."
                    : caseId === "behavior-giraffe"
                      ? "The giraffe reaches leaves on an actual tree canopy, browses one portion and raises its head again. Canopy leaves slowly regrow while the world runs."
                      : caseId === "behavior-beaver"
                        ? "The beaver takes real branches, carries them to the foundation and builds a small brush shelter in four stages. Fallen branch piles slowly replenish during active play."
                        : caseId === "behavior-chicken"
                          ? "The chicken scratches real soil, uncovers one seed and pecks it up to eat. Soil patches slowly replenish during active play."
                          : caseId === "behavior-bee"
                            ? "The bee sips finite nectar, carries pollen to a different bloom and helps one nearby depleted crop grow. Golden blooms were recently pollinated."
                            : caseId === "behavior-hummingbird"
                              ? "The hummingbird hovers to sip nectar, then briefly guards its flower against other hummingbirds. Empty flowers slowly refill during active play."
                              : caseId === "behavior-goat"
                                ? "The goat rears to browse a leafy shrub, lowers again and hops onto a real low rock to rest before jumping down. Shrubs slowly grow new leaves."
                                : caseId === "behavior-pig"
                                  ? "The pig sniffs a root patch, digs with its snout, uncovers one real root and eats it. Depleted patches slowly replenish while the world runs."
                                  : caseId === "behavior-elephant"
                                    ? "The elephant reaches for actual tree fruit, curls it to its mouth and eats. It can also shake limited fruit loose for other foragers."
                                    : caseId === "behavior-capuchin"
                                      ? "The monkey climbs a real tree, picks one fruit, eats on the crown and climbs down. The crop slowly regrows while the world runs."
                                      : caseId === "behavior-raccoon"
                                        ? "The raccoon takes actual food from the squirrel’s cache and carries it under a tree to eat. The squirrel gathers nuts to refill its cache."
                                        : caseId.startsWith("behavior-cat")
                                          ? "The cat crouches, stalks, pounces and bats a physical ball, then chases it again. After playing it can climb to rest on the tree."
                                          : caseId === "behavior-dog"
                                            ? "Throw a ball and wait for it to settle. The dog picks it up, carries it back and drops it near you. Throw again to reuse the returned ball."
                                            : caseId === "behavior-crow"
                                              ? "The crow gathers real loose twigs, carries them to a tree perch and builds its nest in four visible stages."
                                              : caseId === "behavior-rabbit"
                                                ? "The rabbit hops to an edible plant, nibbles it in three visible stages and checks for danger between bites. Food is finite; reset the scene to replenish it."
                                                : caseId === "behavior-robin"
                                                  ? "The robin flies down from an actual tree canopy, pecks and eats the ground food, then flies back to its perch."
                                                  : caseId === "behavior-meerkat"
                                                    ? "The group takes turns standing upright to scan. Place a tiger nearby to see the lookout give an alarm and the group escape."
                                                    : "The squirrel gathers real nuts and fruit, buries food in a cache, rests, then digs it up and eats it."}
          </p>
          {caseId === "behavior-dog" && (
            <button
              type="button"
              disabled={paused}
              onClick={() =>
                void host.current
                  ?.command({ kind: "throw-ball", dirX: 1, dirY: 0, force: 0 })
                  .catch((e) => setError(String(e)))
              }
            >
              Throw ball for dog
            </button>
          )}
          {caseId === "behavior-hummingbird" && (
            <button
              type="button"
              disabled={paused}
              onClick={() =>
                void host.current
                  ?.command({
                    kind: "place-entity",
                    entityType: faunaType("ruby-throated-hummingbird"),
                    position: { wx: 146, wy: 174 },
                  })
                  .catch((e) => setError(String(e)))
              }
            >
              Place visiting hummingbird
            </button>
          )}
          {caseId === "behavior-meerkat" && (
            <button
              type="button"
              disabled={paused}
              onClick={() =>
                void host.current
                  ?.command({
                    kind: "place-entity",
                    entityType: predatorType("tiger"),
                    position: { wx: 244, wy: 176 },
                  })
                  .catch((e) => setError(String(e)))
              }
            >
              Place tiger nearby
            </button>
          )}
        </div>
      )}
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
            disabled={predatorCase}
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
        {ANIMAL_BROWSER_ENTRIES.some((a) => a.scene === caseId) && (
          <label>
            <input
              type="checkbox"
              checked={watchAnimal}
              onChange={(e) => setWatchAnimal(e.target.checked)}
            />{" "}
            Follow selected animal
          </label>
        )}
        <label>
          Zoom{" "}
          <select
            aria-label="Landscape zoom"
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
          >
            {![0.25, 0.13, 0.3, 0.4, 0.6, 0.8, 1.3].includes(zoom) && (
              <option value={zoom}>Animal detail ({zoom}×)</option>
            )}
            <option value={0.25}>Countryside</option>
            <option value={0.13}>Speedway overview</option>
            <option value={0.3}>Scenery</option>
            <option value={0.4}>Wide</option>
            <option value={0.6}>Roomy</option>
            <option value={0.8}>Normal</option>
            <option value={1.3}>Close</option>
          </select>
        </label>
        {!predatorCase && (
          <>
            <a href={naturalExplorerUrl(point, profile)}>Regional planning overview →</a>
            <a href={naturalExplorerUrl(point, profile, 16)}>Exact tile view →</a>
          </>
        )}
      </div>
      <p>
        {caseId === "lake" ? (
          "Large wildlife lake · E beside the motorboat to board; Arrows/WASD steer, R reverses. Return beside a clear shore to get out. Fish schools and varied water animals use the same AI as the game."
        ) : caseId === "racetrack" ? (
          "City outskirts speedway · Eight cars race around the oval. Walk to the spectator seating, picnic area or track; cars stop for people. Use Arrows/WASD to walk, Space to jump, and E beside a stopped car to drive."
        ) : predatorCase ? (
          "Hunting playground · Arrows/WASD to walk, Space to jump. Eaten natural animals return after 60–120 seconds, far from the meal and away from players. Animals you place stay gone when eaten. Throw a ball in the game to interrupt a hunt."
        ) : (
          <>
            Seed {point.seed} · {point.x}, {point.y} tiles · Arrows/WASD to walk, Space to jump.
            Forest centers and edges use the same generator as the map.
            {profile === "thicket" &&
              " Forest rows have real collision; their cap edges and ground joins are part of this preview review."}
          </>
        )}
      </p>
      {predatorCase && (
        <details>
          <summary>Who can eat whom?</summary>
          <p>Players, companion cats and dogs, and ridden animals are protected.</p>
          <table>
            <thead>
              <tr>
                <th>Creature</th>
                <th>Can hunt</th>
              </tr>
            </thead>
            <tbody>
              {FOOD_WEB.filter((r) => r.eats.length).map((r) => (
                <tr key={r.species}>
                  <td>
                    {PREDATOR_PROFILES.find((p) => p.species === r.species)?.label ??
                      r.species.replaceAll("-", " ")}
                  </td>
                  <td>{r.eats.map((s) => s.replaceAll("-", " ")).join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
      <button
        type="button"
        onClick={() => {
          audio.current ??= new AudioManager();
          if (!sounds) {
            audio.current.tryResume();
            void audio.current.preload(buildFootstepManifest());
          } else audio.current.stopCreatureCalls();
          setSounds(!sounds);
        }}
      >
        {sounds ? "Creature sounds on" : "Enable creature sounds"}
      </button>
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
              [
                "ArrowLeft",
                "ArrowRight",
                "ArrowUp",
                "ArrowDown",
                " ",
                "w",
                "a",
                "s",
                "d",
                "r",
                "Shift",
              ].includes(e.key)
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
        {(FAUNA_PROFILES.some((p) => p.species === caseId)
          ? FAUNA_PROFILES.filter((p) => p.species === caseId).map((p) => ({
              type: faunaType(p.species),
              label: p.label,
            }))
          : caseId === "deer"
            ? [{ type: DEER_TYPE, label: "deer" }]
            : caseId === "robins"
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
                  // Mounts need a real falling landing, above the automatic step-down range.
                  z:
                    (target.wz ?? 0) +
                    (faunaProfile(target.type)?.body[2] ?? 24) +
                    (faunaProfile(target.type)?.rideSpeed ? 8 : 2),
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
