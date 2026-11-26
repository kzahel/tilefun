import { useEffect, useMemo, useRef, useState } from "react";
import type { ArtCatalog } from "../art/ArtCatalog.js";
import { AudioManager } from "../audio/AudioManager.js";
import { FootstepSystem } from "../audio/FootstepSystem.js";
import { buildAudioManifest } from "../audio/SurfaceType.js";
import { isBoat } from "../boats/Boat.js";
import { LabView } from "../client/LabView.js";
import { CHUNK_SIZE_PX, TILE_SIZE } from "../config/constants.js";
import {
  loadWildlifeModels,
  saveWildlifeModels,
  wildlifeModelsInLink,
} from "../config/wildlifeModels.js";
import { ENTITY_DEFS } from "../entities/EntityDefs.js";
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
import {
  isSpineDefenseModelReviewCase,
  isWildlifeBehaviorModelReview,
} from "../scenarios/WildlifeBehaviorModelReview.js";
import {
  canLandOnReviewAnimal,
  isFarmModelReviewCase,
  isFourStateFaunaModelReview,
  isPackMountModelReview,
  wildlifeFeedingReview,
  wildlifeModelReviewRecipe,
} from "../scenarios/WildlifeModelReviewRecipe.js";
import { fixedCamera } from "../session/View.js";
import { DEER_TYPE } from "../wildlife/Deer.js";
import { FAUNA_PROFILES, faunaProfile, faunaType } from "../wildlife/Fauna.js";
import { FIERCE_DENS } from "../wildlife/FierceDens.js";
import { creatureSpecies, FOOD_WEB } from "../wildlife/FoodWeb.js";
import { FROG_TYPE } from "../wildlife/Frog.js";
import { MALLARD_TYPE } from "../wildlife/Mallard.js";
import { PREDATOR_PROFILES, predatorType } from "../wildlife/Predator.js";
import { RABBIT_TYPE } from "../wildlife/Rabbit.js";
import { ROBIN_TYPE } from "../wildlife/Robin.js";
import { WILDLIFE_MODEL_REVIEWS } from "../wildlife/WildlifeModelReviewBank.js";
import { CollisionFlag } from "../world/TileRegistry.js";
import AnimalBrowser from "./AnimalBrowser.js";
import { ANIMAL_BROWSER_ENTRIES } from "./AnimalBrowserData.js";
import { naturalCasePresentation, naturalCaseZoom } from "./NaturalCasePresentation.js";
import { buildNaturalCandidate } from "./NaturalLandscapeCandidate.js";
import { WildlifeApproachControls } from "./WildlifeApproachControls.js";
import { useInbox, useManifest } from "./WorkshopQueries.js";
import { useWorkspace } from "./WorkspaceStore.js";

interface LandingTarget {
  type: string;
  label: string;
  water?: boolean;
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
  const [wildlifeModels, setWildlifeModels] = useState(loadWildlifeModels);
  const [usingModels, setUsingModels] = useState(false);
  const audio = useRef<AudioManager | null>(null),
    footsteps = useRef<FootstepSystem | null>(null);
  const audioTime = useRef(0);
  const audioFocused = useRef(true);
  useEffect(() => () => audio.current?.dispose(), []);
  const [zoom, setZoom] = useState(naturalCaseZoom(caseId)),
    [reset, setReset] = useState(0),
    [error, setError] = useState("");
  const [ready, setReady] = useState(false),
    [verified, setVerified] = useState("");
  const [message, setMessage] = useState("");
  const canvas = useRef<HTMLCanvasElement>(null),
    host = useRef<LabView | null>(null);
  const openedPlayground = useRef(false);
  const linkedView = wildlifeModelsInLink(initial) !== undefined;
  useEffect(() => {
    if (!linkedView || !ready || openedPlayground.current) return;
    openedPlayground.current = true;
    canvas.current?.scrollIntoView({ block: "center" });
  }, [linkedView, ready]);
  const settings = useRef({ paused, follow, zoom, sounds, watchAnimal, wildlifeModels });
  settings.current = { paused, follow, zoom, sounds, watchAnimal, wildlifeModels };
  const custom = caseId === "explore",
    presentation = naturalCasePresentation(caseId);
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
  const modelStage = initial.get("wildlife3dStage");
  const prepared = useMemo(() => {
    try {
      const selected = WILDLIFE_MODEL_REVIEWS.find(
        (row) => row.id === modelStage && row.lab === caseId,
      );
      const review =
        selected && wildlifeModelReviewRecipe(selected.type, caseId, selected.classicTravel);
      return {
        recipe: review ?? naturalLandscapeRecipe(caseId, profile, custom ? point : undefined),
        modelReview: !!review,
        reviewSheet: selected && ENTITY_DEFS[selected.type]?.sprite?.sheetKey,
        reviewAnimal: review && selected,
        error: "",
      };
    } catch (e) {
      return { recipe: undefined, modelReview: false, error: String(e) };
    }
  }, [caseId, profile, point, custom, modelStage]);
  const manifest = useManifest(),
    inbox = useInbox();
  const candidate = prepared.modelReview
    ? undefined
    : manifest.data?.candidates.find((c) => c.id === `nature:${caseId}:${profile}:v1`);
  const reviewAnimal = prepared.reviewAnimal;
  const farmAnimal =
    reviewAnimal?.classicTravel || !isFarmModelReviewCase(caseId) ? undefined : reviewAnimal;
  const approachAnimal =
    farmAnimal ??
    (reviewAnimal &&
    (wildlifeFeedingReview(reviewAnimal.type, caseId) ||
      isWildlifeBehaviorModelReview(reviewAnimal.type, caseId) ||
      isPackMountModelReview(reviewAnimal.type, caseId) ||
      isFourStateFaunaModelReview(reviewAnimal.type, caseId))
      ? reviewAnimal
      : undefined);
  const fauna = FAUNA_PROFILES.find((animal) => animal.species === caseId);
  const landingTargets: readonly LandingTarget[] =
    reviewAnimal && fauna?.habitat === "shore"
      ? [
          { type: reviewAnimal.type, label: `${reviewAnimal.name} ashore`, water: false },
          { type: reviewAnimal.type, label: `${reviewAnimal.name} in water`, water: true },
        ]
      : fauna
        ? [{ type: faunaType(fauna.species), label: fauna.label }]
        : reviewAnimal &&
            !reviewAnimal.classicTravel &&
            canLandOnReviewAnimal(reviewAnimal.type, caseId)
          ? [{ type: reviewAnimal.type, label: reviewAnimal.name }]
          : (presentation.mounts ?? []);
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
    setUsingModels(false);
    setError("");
    setPaused(false);
    const { camera } = presentation;
    const h = new LabView(c, recipe, {
      width: 960,
      height: 640,
      terrain: true,
      camera: fixedCamera((player, alpha) => {
        if (camera) return camera;
        const train = host.current?.client.replica.entities.find((e) => e.type === CURVE_TRAIN);
        const watched = settings.current.watchAnimal
          ? ANIMAL_BROWSER_ENTRIES.find((a) => a.scene === caseId)
          : undefined;
        const animal = watched
          ? host.current?.client.replica.entities.find((e) => e.type === watched.type)
          : undefined;
        const target = animal ?? (settings.current.follow && train ? train : player);
        const p = interpolatePosition(target.position, target.prevPosition, alpha);
        const selected = FAUNA_PROFILES.find((p) => p.species === caseId);
        const ray =
          selected?.habitat === "deep"
            ? host.current?.client.replica.entities.find(
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
      }),
      settings: () => ({
        paused: settings.current.paused,
        zoom: settings.current.zoom,
        terrainPacing: "throughput",
        wildlifeModels: settings.current.wildlifeModels,
      }),
      onFrame: (h) => {
        const sound = audio.current,
          view = h.client.replica;
        if (sound) {
          const enabled =
            settings.current.sounds &&
            !settings.current.paused &&
            !document.hidden &&
            audioFocused.current;
          sound.updateCreatureCalls(view.entities, view.playerEntity.position, enabled);
          footsteps.current ??= new FootstepSystem(
            sound,
            () => h.client.replica.world,
            () => h.camera,
            () => h.client.replica.playerEntity,
            () => h.client.replica.props,
          );
          const now = performance.now();
          if (enabled && audioTime.current)
            footsteps.current.update(
              Math.min(0.1, (now - audioTime.current) / 1000),
              view.entities,
            );
          audioTime.current = now;
          c.dataset.creatureCalls = String(sound.creatureAudioDiagnostics.played);
        }
        c.dataset.foodWebActors = JSON.stringify(
          view.entities.filter((e) => creatureSpecies(e)).map((e) => ({ id: e.id, type: e.type })),
        );
        c.dataset.predatorPoses = JSON.stringify(
          view.entities
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
          view.props
            .filter((p) => FIERCE_DENS.some((d) => d.type === p.type))
            .map((p) => ({ type: p.type, x: p.position.wx, y: p.position.wy })),
        );
        const ducks = view.entities.filter((e) => e.type === MALLARD_TYPE);
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
        const frogs = view.entities.filter((e) => e.type === FROG_TYPE);
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
        const rabbits = view.entities.filter((e) => e.type === RABBIT_TYPE);
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
        const robins = view.entities.filter((e) => e.type === ROBIN_TYPE);
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
        const fauna = view.entities.filter((e) => faunaProfile(e.type));
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
        const deer = view.entities.filter((e) => e.type === DEER_TYPE);
        c.dataset.deerCount = String(deer.length);
        c.dataset.deerPoses = JSON.stringify(
          deer.map((e) => ({
            id: e.id,
            type: e.type,
            x: e.position.wx,
            y: e.position.wy,
            z: e.wz ?? 0,
            clip: e.sprite?.clip,
            frame: e.sprite?.frameCol,
            state: e.wanderAI?.state,
            direction: e.sprite?.direction,
          })),
        );
        if (caseId === "racetrack") {
          const racers = new Map(
            Object.entries(h.client.handles)
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
        const wildlifeMeshes = String(diagnostics.wildlifeMeshes);
        if (c.dataset.wildlifeMeshes !== wildlifeMeshes) c.dataset.wildlifeMeshes = wildlifeMeshes;
        setUsingModels(diagnostics.wildlifeModelsSelected > 0);
        if (prepared.reviewSheet) {
          const drawn = String(h.wildlifeModelDrawn(prepared.reviewSheet));
          if (c.dataset.wildlifeReviewModelDrawn !== drawn)
            c.dataset.wildlifeReviewModelDrawn = drawn;
        }
        if (reviewAnimal?.classicTravel) {
          c.dataset.classicWildlifePoses = JSON.stringify(
            view.entities
              .filter((e) => e.type === reviewAnimal.type && e.sprite)
              .map((e) => ({ type: e.type, clip: e.sprite?.moving ? 1 : 0, z: e.wz ?? 0 })),
          );
        }
        c.dataset.authorityRunning = String(diagnostics.authority.clock?.running ?? false);
        c.dataset.terrainPending = String(diagnostics.terrain?.pending ?? -1);
        c.dataset.terrainResident = String(diagnostics.terrain?.resident ?? 0);
        const pos = view.playerEntity.position;
        const cx = Math.floor(pos.wx / CHUNK_SIZE_PX),
          cy = Math.floor(pos.wy / CHUNK_SIZE_PX);
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
    const release = () => {
      audioFocused.current = false;
      audio.current?.stopCreatureCalls();
    };
    const focus = () => {
      audioFocused.current = true;
    };
    window.addEventListener("blur", release);
    window.addEventListener("focus", focus);
    return () => {
      active = false;
      h.dispose();
      audio.current?.stopCreatureCalls();
      footsteps.current = null;
      audioTime.current = 0;
      host.current = null;
      delete c.dataset.ready;
      delete c.dataset.wildlifeMeshes;
      delete c.dataset.wildlifeReviewModelDrawn;
      window.removeEventListener("blur", release);
      window.removeEventListener("focus", focus);
    };
  }, [prepared, reset]);
  function change(nextCase: string, nextProfile: typeof profile) {
    setWatchAnimal(ANIMAL_BROWSER_ENTRIES.some((a) => a.scene === nextCase));
    setCaseId(nextCase);
    setProfile(nextProfile);
    setFollow(nextCase === "train");
    setZoom(naturalCaseZoom(nextCase));
    setMessage("");
    const url = new URL(location.href);
    url.searchParams.set("geometry", `nature-${nextCase}`);
    url.searchParams.set("landscape", nextProfile);
    history.replaceState(null, "", url);
  }
  function vote(verdict: "approved" | "changes") {
    if (!candidate || !allowed) return;
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
  const allowed =
    ready &&
    !usingModels &&
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
          <p>{presentation.description}</p>
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
          {(caseId === "behavior-meerkat" || caseId === "behavior-deer") && (
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
        {presentation.guide ? (
          presentation.guide
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
            void audio.current.preload(buildAudioManifest());
          } else audio.current.stopCreatureCalls();
          setSounds(!sounds);
        }}
      >
        {sounds ? "Creature sounds on" : "Enable creature sounds"}
      </button>
      <label>
        <input
          type="checkbox"
          checked={wildlifeModels}
          onChange={(e) => {
            const enabled = e.currentTarget.checked;
            setWildlifeModels(enabled);
            try {
              saveWildlifeModels(enabled);
            } catch {
              setError("The 3D animals choice could not be saved.");
            }
          }}
        />{" "}
        3D animals
      </label>
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
        />
      </div>
      <div className="actions geometry-controls">
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
            void host.current
              ?.reload()
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
        {approachAnimal && (
          <WildlifeApproachControls
            lab={host}
            canvas={canvas}
            animal={approachAnimal}
            disabled={!ready || paused}
            retreat={
              isSpineDefenseModelReviewCase(caseId) ? prepared.recipe?.player.position : undefined
            }
            reportError={setError}
          />
        )}
        {landingTargets.map((animal) => (
          <button
            key={animal.label}
            type="button"
            disabled={!ready || paused}
            onClick={() => {
              const h = host.current;
              if (!h) return;
              const { entities, world } = h.client.replica;
              const target = entities.find((e) => {
                if (e.type !== animal.type || e.wanderAI?.state === "scared" || (e.wz ?? 0) >= 0.5)
                  return false;
                if (animal.water === undefined) return true;
                const tile = world.getCollisionIfLoaded(
                  Math.floor(e.position.wx / TILE_SIZE),
                  Math.floor(e.position.wy / TILE_SIZE),
                );
                return ((tile & CollisionFlag.Water) !== 0) === animal.water;
              });
              if (!target) return;
              if (canvas.current) canvas.current.dataset.playerMaxVz = "0";
              void h
                .command({
                  kind: "teleport",
                  position: { ...target.position },
                  // Mounts need a real falling landing, above the automatic step-down range.
                  z:
                    (target.wz ?? 0) +
                    (target.collider?.physicalHeight ?? faunaProfile(target.type)?.body[2] ?? 24) +
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
            {usingModels
              ? "Turn off 3D animals to review the sprite scene."
              : message || (!verified ? "Checking the registered composition…" : "")}
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
