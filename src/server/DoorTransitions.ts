import { TILE_SIZE } from "../config/constants.js";
import type { Prop } from "../entities/Prop.js";
import { buildingDoor, exteriorDoors } from "../interiors/BuildingDoors.js";
import {
  atDoorThreshold,
  DOOR_APPROACH_LEAD,
  DOOR_FADE_MS,
  DOOR_WALK_MS,
  type DoorMotion,
  exteriorDoorWalkAnchor,
  towardDoor,
} from "../interiors/DoorTraversal.js";
import { exteriorEntrance, interiorRealmId } from "../interiors/GameplayInterior.js";
import type { IServerTransport } from "../transport/Transport.js";
import type { PlayerSession } from "./PlayerSession.js";
import type { Realm } from "./Realm.js";
import type { RealmDirectory } from "./RealmDirectory.js";
import type { RealmDestination, RealmTransitions } from "./RealmTransitions.js";
import type { SessionRegistry } from "./SessionRegistry.js";

export interface DoorTransitionsDeps {
  realms: RealmDirectory;
  sessions: SessionRegistry;
  transport: IServerTransport;
  /** Party travel: the requesting seat leads its device through the door (226). */
  transitions: Pick<RealmTransitions, "move">;
}

type Point = { wx: number; wy: number };

/** Building entry and exit: door validation, destination resolution and door-walk motion. */
export class DoorTransitions {
  constructor(private readonly deps: DoorTransitionsDeps) {}

  async enter(
    session: PlayerSession,
    featureId: string,
    doorId = "street",
    walkThrough = false,
  ): Promise<void> {
    await this.deps.transitions.move(session, () =>
      this.entranceDestination(session, featureId, doorId, walkThrough),
    );
    if (walkThrough) this.arriveDoor(session, true);
  }

  async exit(session: PlayerSession, doorId = "street", walkThrough = false): Promise<void> {
    let overlay: DoorMotion["overlay"];
    let emergence: DoorMotion["from"] | undefined;
    await this.deps.transitions.move(session, async () => {
      const realm = session.realmId ? this.deps.realms.get(session.realmId) : undefined;
      if (!realm?.interior) throw new Error("You are not in an interior.");
      const connection = buildingDoor(realm.interior, doorId);
      if (
        Math.hypot(
          session.player.position.wx - connection.inside.wx,
          session.player.position.wy - connection.inside.wy,
        ) > 40
      )
        throw new Error("Return to the interior doorway to leave.");
      if (walkThrough) this.validateDoorApproach(session, connection.inside, false);
      const parent = await this.deps.realms.getOrCreate(realm.interior.parentWorldId);
      parent.realizeProceduralProps();
      const prop = parent.propManager.props.find(
        (p) => p.proceduralId === realm.interior?.featureId,
      );
      const outside =
        (prop ? exteriorDoors(prop).find((door) => door.id === doorId)?.outside : undefined) ??
        connection.outside;
      emergence = exteriorDoorWalkAnchor(outside);
      const position = {
        worldId: connection.outsideRealmId,
        x: outside.wx / TILE_SIZE,
        y: outside.wy / TILE_SIZE,
        generation: parent.generation,
      };
      return {
        ...(walkThrough
          ? {
              beforeTransfer: () => {
                // SafeArrival has now loaded the outdoor chunks. The facade may
                // have been evicted while everyone was inside the building.
                const facade = parent.propManager.props.find(
                  (p) => p.proceduralId === realm.interior?.featureId,
                );
                if (facade?.type.includes("butcher"))
                  overlay = { kind: "butcher", wx: outside.wx, wy: facade.position.wy };
                return this.departDoor(session, {
                  wx: connection.inside.wx,
                  wy: connection.inside.wy + 16,
                });
              },
            }
          : {}),
        realm: await this.deps.realms.getOrCreate(position.worldId),
        arrival: position,
        returnLocation: null,
      };
    });
    if (walkThrough) this.arriveDoor(session, false, overlay, emergence);
  }

  private async entranceDestination(
    session: PlayerSession,
    featureId: string,
    doorId: string,
    walkThrough: boolean,
  ): Promise<RealmDestination> {
    const { realm, worldId, prop } = this.exteriorBuilding(session, featureId, doorId, walkThrough);
    const destination = await this.deps.realms.getOrCreate(interiorRealmId(worldId, featureId));
    const { connection, door } = this.entranceDoor(session, prop, destination, doorId);
    const overlay: DoorMotion["overlay"] =
      walkThrough && prop.type.includes("butcher")
        ? { kind: "butcher", wx: door.wx, wy: prop.position.wy }
        : undefined;
    return {
      ...(walkThrough
        ? {
            beforeTransfer: () => this.departDoor(session, exteriorDoorWalkAnchor(door), overlay),
          }
        : {}),
      realm: destination,
      allowInterior: true,
      arrival: {
        x: connection.arrival.wx / TILE_SIZE,
        y: connection.arrival.wy / TILE_SIZE,
        generation: destination.generation,
      },
      returnLocation: {
        worldId,
        x: door.wx / 16,
        y: door.wy / 16,
        generation: realm.generation,
      },
    };
  }

  /** The exterior building the player stands at, with its walk-through approach checked. */
  private exteriorBuilding(
    session: PlayerSession,
    featureId: string,
    doorId: string,
    walkThrough: boolean,
  ): { realm: Realm; worldId: string; prop: Prop } {
    const realm = session.realmId ? this.deps.realms.get(session.realmId) : undefined;
    if (!realm || realm.interior || !realm.currentWorldId)
      throw new Error("No exterior world selected.");
    realm.realizeProceduralProps();
    const prop = realm.propManager.props.find((p) => p.proceduralId === featureId);
    if (!prop || !exteriorEntrance(prop)) throw new Error("Building is unavailable.");
    if (walkThrough) {
      const threshold = exteriorDoors(prop).find((d) => d.id === doorId)?.outside;
      if (!threshold) throw new Error("Unknown building door.");
      this.validateDoorApproach(session, threshold, true);
    }
    return { realm, worldId: realm.currentWorldId, prop };
  }

  /** The interior connection and facade door for an entry, which the player must stand near. */
  private entranceDoor(session: PlayerSession, prop: Prop, destination: Realm, doorId: string) {
    if (!destination.interior) throw new Error("Building interior unavailable.");
    // Older rooms keep their single physical exit. A newly discoverable facade
    // door can still enter that saved room through its original landing.
    const legacyAlias =
      !destination.interior.layout &&
      !destination.interior.doors?.some((door) => door.id === doorId) &&
      exteriorDoors(prop).some((door) => door.id === doorId);
    const connection = buildingDoor(destination.interior, legacyAlias ? "street" : doorId);
    const door =
      exteriorDoors(prop).find((door) => door.id === doorId)?.outside ?? connection.outside;
    if (
      Math.hypot(session.player.position.wx - door.wx, session.player.position.wy - door.wy) > 32 ||
      (session.player.wz ?? 0) > 8
    )
      throw new Error("Stand near the building entrance to enter.");
    return { connection, door };
  }

  private validateDoorApproach(session: PlayerSession, door: Point, entering: boolean) {
    if (
      session.editorEnabled ||
      session.gameplaySession.mountId !== null ||
      Date.now() < session.doorArrivalUntil ||
      (session.player.wz ?? 0) > 1 ||
      Date.now() - session.doorIntent.at > 500 ||
      !towardDoor(session.doorIntent.dx, session.doorIntent.dy, entering) ||
      // Clients wait for this same lead before requesting (doorwayReached).
      !atDoorThreshold(session.player.position, door, entering, DOOR_APPROACH_LEAD)
    )
      throw new Error("Walk toward the doorway to enter.");
  }

  private sendDoorMotion(
    session: PlayerSession,
    phase: DoorMotion["phase"],
    from: DoorMotion["from"],
    to: DoorMotion["to"],
    overlay?: DoorMotion["overlay"],
    revealMs?: number,
  ) {
    for (const recipient of this.deps.sessions.values()) {
      if (recipient.realmId !== session.realmId || recipient.retired) continue;
      this.deps.transport.send(recipient.clientId, {
        type: "door-motion",
        phase,
        actorId: session.player.id,
        actorClientId: session.clientId,
        realmId: session.realmId ?? "",
        self: recipient === session,
        from,
        to,
        duration: DOOR_WALK_MS,
        ...(revealMs && recipient === session ? { revealMs } : {}),
        ...(overlay ? { overlay } : {}),
      });
    }
  }

  private async departDoor(
    session: PlayerSession,
    to: DoorMotion["to"],
    overlay?: DoorMotion["overlay"],
  ) {
    const from = { ...session.player.position };
    session.player.velocity = { vx: 0, vy: 0 };
    session.inputQueue = [];
    this.sendDoorMotion(session, "depart", from, to, overlay);
    // Presentation only: durable authority remains at the collision-checked source.
    // This bounded wait also settles during dev reload/shutdown; it needs no simulation ticks.
    await new Promise((resolve) => setTimeout(resolve, DOOR_WALK_MS + DOOR_FADE_MS));
  }

  private arriveDoor(
    session: PlayerSession,
    entering: boolean,
    overlay?: DoorMotion["overlay"],
    emergence?: DoorMotion["from"],
  ) {
    const to = { ...session.player.position };
    const from = emergence ?? { wx: to.wx, wy: to.wy + (entering ? 16 : -16) };
    session.doorArrivalUntil = Date.now() + DOOR_WALK_MS + DOOR_FADE_MS;
    session.inputQueue = [];
    session.player.velocity = { vx: 0, vy: 0 };
    this.sendDoorMotion(session, "arrive", from, to, overlay, emergence ? DOOR_FADE_MS : undefined);
  }
}
