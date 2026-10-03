import { CHUNK_SIZE_PX } from "../config/constants.js";
import type { Entity } from "../entities/Entity.js";
import { ENTITY_FACTORIES } from "../entities/EntityFactories.js";
import type { Prop } from "../entities/Prop.js";
import { createProp } from "../entities/PropFactories.js";
import { generateUUID } from "../shared/uuid.js";

export interface ActorRecord {
  version: 2;
  persistentId: string;
  kind: "entity" | "prop";
  type: string;
  wx: number;
  wy: number;
  proceduralId?: string;
  originScope?: string;
  spawnTimer?: number;
  parent?: string;
  state: Partial<Entity>;
}

/** Explicit semantic fields. Render frames, spatial state and script attributes are transient. */
export const DURABLE_ENTITY_FIELDS = [
  "velocity",
  "wanderAI",
  "routeAI",
  "deathTimer",
  "wz",
  "jumpVZ",
  "jumpZ",
  "localOffsetX",
  "localOffsetY",
  "weight",
] as const;

export function actorScope(position: { wx: number; wy: number }): string {
  return `${Math.floor(position.wx / CHUNK_SIZE_PX)},${Math.floor(position.wy / CHUNK_SIZE_PX)}`;
}

export function durableId(actor: Entity | Prop): string {
  actor.persistentId ??= generateUUID();
  return actor.persistentId;
}

export function encodeActor(actor: Entity | Prop, parent?: Entity): ActorRecord {
  const state: Partial<Entity> = {};
  if (!("isProp" in actor)) {
    for (const field of DURABLE_ENTITY_FIELDS) Object.assign(state, { [field]: actor[field] });
  }
  // Semantic payload contains plain numeric/boolean/string data; JSON also strips
  // undefined optionals and unwraps mutation-observed component objects.
  return JSON.parse(
    JSON.stringify({
      version: 2,
      persistentId: durableId(actor),
      kind: "isProp" in actor ? "prop" : "entity",
      type: actor.type,
      wx: actor.position.wx,
      wy: actor.position.wy,
      ...(actor.proceduralId ? { proceduralId: actor.proceduralId } : {}),
      ...(parent ? { parent: durableId(parent) } : {}),
      ...("isProp" in actor && actor.spawnTimer !== undefined
        ? { spawnTimer: actor.spawnTimer }
        : {}),
      state,
    }),
  ) as ActorRecord;
}

export function decodeActor(record: ActorRecord): Entity | Prop {
  if (
    record.version !== 2 ||
    !record.persistentId ||
    !Number.isFinite(record.wx) ||
    !Number.isFinite(record.wy)
  )
    throw new Error("Invalid saved actor record.");
  let actor: Entity | Prop;
  if (record.kind === "prop") actor = createProp(record.type, record.wx, record.wy);
  else {
    const factory = ENTITY_FACTORIES[record.type];
    if (!factory) throw new Error(`Unsupported saved actor kind: ${record.type}`);
    actor = factory(record.wx, record.wy);
    for (const field of DURABLE_ENTITY_FIELDS) {
      if (Object.hasOwn(record.state, field))
        Object.assign(actor, { [field]: structuredClone(record.state[field]) });
    }
  }
  if (!("isProp" in actor) && actor.wanderAI?.state === "ridden") {
    actor.wanderAI.state = "idle";
    actor.wanderAI.timer = 1;
  }
  if ("isProp" in actor && record.spawnTimer !== undefined) actor.spawnTimer = record.spawnTimer;
  actor.persistentId = record.persistentId;
  if (record.proceduralId) actor.proceduralId = record.proceduralId;
  return actor;
}

/** Observe component edits without scanning or serializing unchanged actors. */
export function observeActor(actor: Entity | Prop, changed: () => void): void {
  const proxies = new WeakMap<object, object>();
  const observe = (value: unknown): unknown => {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    const existing = proxies.get(value);
    if (existing) return existing;
    const proxy = new Proxy(value, {
      get: (target, property, receiver) => observe(Reflect.get(target, property, receiver)),
      set: (target, property, next) => {
        if (Reflect.get(target, property) === next) return true;
        const result = Reflect.set(target, property, next);
        if (result) changed();
        return result;
      },
      deleteProperty: (target, property) => {
        const existed = Reflect.has(target, property);
        const result = Reflect.deleteProperty(target, property);
        if (existed && result) changed();
        return result;
      },
    });
    proxies.set(value, proxy);
    proxies.set(proxy, proxy);
    return proxy;
  };
  const fields =
    "isProp" in actor
      ? ["position", "spawnTimer"]
      : ["position", "parentId", ...DURABLE_ENTITY_FIELDS];
  for (const field of fields) {
    let value = observe(Reflect.get(actor, field));
    Object.defineProperty(actor, field, {
      configurable: true,
      enumerable: value !== undefined,
      get: () => value,
      set: (next) => {
        if (next !== value) {
          value = observe(next);
          changed();
        }
      },
    });
  }
}
