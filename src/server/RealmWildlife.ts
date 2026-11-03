import { TerrainId } from "../autotile/TerrainId.js";
import {
  aabbOverlapsPropWalls,
  aabbOverlapsSolid,
  aabbsOverlap,
  getEntityAABB,
} from "../entities/collision.js";
import type { Entity, PositionComponent } from "../entities/Entity.js";
import { durableId } from "../persistence/ActorRecords.js";
import { setBodyPose } from "../physics/PhysicalEdits.js";
import { getSurfaceZ } from "../physics/surfaceHeight.js";
import type { WorkContext } from "../wildlife/AnimalWorkSystem.js";
import { browsingRocks } from "../wildlife/BrowsingRocks.js";
import { createFierceDen, denForPredator } from "../wildlife/FierceDens.js";
import type { WildlifeEnvironment } from "../wildlife/mallardAI.js";
import { robinTreePerches } from "../wildlife/robinPerches.js";
import { climbTrees } from "../wildlife/TreeClimbing.js";
import { CollisionFlag } from "../world/TileRegistry.js";
import type { PlayerSession } from "./PlayerSession.js";
import type { Realm } from "./Realm.js";

/** Realm-owned planning/task bindings. Read-only admission queries never integrate bodies. */
export function createRealmWorkContext(
  realm: Pick<Realm, "world" | "entityManager" | "propManager" | "streaming" | "animalWork">,
  entityTickDts: ReadonlyMap<Entity, number>,
  sessions: readonly PlayerSession[],
): WorkContext {
  const getHeight = (x: number, y: number) => realm.world.getHeightAt(x, y);
  const workPlayers = sessions.map((session) => ({
    identity: session.profileId || session.clientId,
    entity: session.player,
  }));
  const workReady = (point: PositionComponent, radius: number) => {
    const range = {
      minCx: Math.floor((point.wx - radius) / 256),
      maxCx: Math.floor((point.wx + radius) / 256),
      minCy: Math.floor((point.wy - radius) / 256),
      maxCy: Math.floor((point.wy + radius) / 256),
    };
    if (realm.streaming) return realm.streaming.rangeReady(range);
    for (let cy = range.minCy; cy <= range.maxCy; cy++)
      for (let cx = range.minCx; cx <= range.maxCx; cx++)
        if (!realm.world.getChunkIfLoaded(cx, cy)) return false;
    return true;
  };
  const wildlifeEnvironment: WildlifeEnvironment = {
    huntCandidates: (hunter, radius) =>
      realm.entityManager.spatialHash
        .queryRange(
          Math.floor((hunter.position.wx - radius) / 256),
          Math.floor((hunter.position.wy - radius) / 256),
          Math.floor((hunter.position.wx + radius) / 256),
          Math.floor((hunter.position.wy + radius) / 256),
        )
        .filter(
          (e) =>
            entityTickDts.has(e) &&
            !e.workItem &&
            Math.hypot(e.position.wx - hunter.position.wx, e.position.wy - hunter.position.wy) <=
              radius,
        ),
    animalWork: (animal, elapsed, planning) =>
      realm.animalWork.update(
        animal,
        elapsed,
        {
          environment: wildlifeEnvironment,
          players: workPlayers,
          ready: workReady,
        },
        planning,
      ),
    ensurePredatorDen: (animal) => {
      const ai = animal.predator,
        spec = denForPredator(animal.type);
      if (!ai || !spec || ai.denPlaced) return;
      // A manually created hunter can already be mid-pursuit. Add its solid
      // perch after that hunt, rather than embedding a rock under its feet.
      if (spec.collider && ai.targetId) return;
      ai.denId ??= `wildlife:den:${animal.naturalSpawnId ?? animal.proceduralId ?? durableId(animal)}`;
      if (
        !realm.propManager.props.some(
          (p) => p.persistentId === ai.denId || p.proceduralId === ai.denId,
        )
      ) {
        const prop = createFierceDen(spec, ai.home.wx, ai.home.wy);
        if (spec.collider) {
          const box = getEntityAABB(prop.position, spec.collider);
          if (
            realm.entityManager.entities.some(
              (other) =>
                other !== animal &&
                other.collider &&
                other.collider.solid !== false &&
                aabbsOverlap(box, getEntityAABB(other.position, other.collider)),
            ) ||
            realm.propManager.props.some((other) =>
              aabbOverlapsPropWalls(box, other.position, other, 0, 24),
            )
          )
            return;
        }
        prop.persistentId = ai.denId;
        realm.propManager.add(prop);
        if (
          spec.collider?.walkableTop &&
          Math.hypot(animal.position.wx - ai.home.wx, animal.position.wy - ai.home.wy) < 4 &&
          !ai.flight
        ) {
          setBodyPose(animal, {
            wz: getSurfaceZ(ai.home.wx, ai.home.wy, getHeight) + (spec.collider.zHeight ?? 0),
          });
          ai.state = "perch";
          ai.timer = 1.5;
          ai.elapsed = 0;
        }
      }
      ai.denPlaced = true;
    },
    predatorPerches: (home, radius) =>
      realm.propManager
        .getPropsInChunkRange(
          Math.floor((home.wx - radius) / 256),
          Math.floor((home.wy - radius) / 256),
          Math.floor((home.wx + radius) / 256),
          Math.floor((home.wy + radius) / 256),
        )
        .flatMap((prop) => {
          const surface =
            prop.type === "prop-griffin-perch"
              ? prop.collider
              : ["prop-oak-tree", "prop-palm-tree"].includes(prop.type)
                ? prop.walls?.find(
                    (w) => w.walkableTop && w.passable && w.width >= 34 && w.height >= 22,
                  )
                : undefined;
          return surface?.walkableTop && surface.zHeight !== undefined
            ? [
                {
                  wx: prop.position.wx + surface.offsetX,
                  wy: prop.position.wy + surface.offsetY,
                  z:
                    getSurfaceZ(prop.position.wx, prop.position.wy, getHeight) +
                    (surface.zBase ?? 0) +
                    surface.zHeight,
                },
              ]
            : [];
        }),
    climbTrees: (home, radius) =>
      climbTrees(
        realm.propManager.getPropsInChunkRange(
          Math.floor((home.wx - radius) / 256),
          Math.floor((home.wy - radius) / 256),
          Math.floor((home.wx + radius) / 256),
          Math.floor((home.wy + radius) / 256),
        ),
        (p) => getSurfaceZ(p.wx, p.wy, getHeight),
      ),
    browsingRocks: (home, radius) =>
      browsingRocks(
        realm.propManager.getPropsInChunkRange(
          Math.floor((home.wx - radius) / 256),
          Math.floor((home.wy - radius) / 256),
          Math.floor((home.wx + radius) / 256),
          Math.floor((home.wy + radius) / 256),
        ),
        (p) => getSurfaceZ(p.wx, p.wy, getHeight),
      ),
    perches: (home, radius) =>
      robinTreePerches(
        realm.propManager.getPropsInChunkRange(
          Math.floor((home.wx - radius) / 256),
          Math.floor((home.wy - radius) / 256),
          Math.floor((home.wx + radius) / 256),
          Math.floor((home.wy + radius) / 256),
        ),
      ),
    surfaceZ: (p) => getSurfaceZ(p.wx, p.wy, getHeight),
    isWater: (p) =>
      (realm.world.getCollisionIfLoaded(Math.floor(p.wx / 16), Math.floor(p.wy / 16)) &
        CollisionFlag.Water) !==
      0,
    isDeepWater: (p) =>
      realm.world.getBlendBaseAt(Math.floor(p.wx / 16), Math.floor(p.wy / 16)) ===
      TerrainId.DeepWater,
    canOccupy: (entity, p) => {
      if (!entity.collider) return false;
      const box = getEntityAABB(p, entity.collider);
      if (
        aabbOverlapsSolid(
          box,
          (tx, ty) => realm.world.getCollisionIfLoaded(tx, ty),
          CollisionFlag.Solid,
        )
      )
        return false;
      return !realm.propManager
        .getPropsNearPosition(p, entity.collider)
        .some((prop) =>
          aabbOverlapsPropWalls(
            box,
            prop.position,
            prop,
            entity.wz ?? 0,
            entity.collider?.physicalHeight ?? 9,
          ),
        );
    },
  };
  return { environment: wildlifeEnvironment, players: workPlayers, ready: workReady };
}
