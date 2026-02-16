import { ENTITY_FACTORIES } from "../entities/EntityFactories.js";
import {
  setAccelerate,
  setAirAccelerate,
  setAirWishCap,
  setFriction,
  setGravityScale,
  setNoBunnyHop,
  setPlatformerAir,
  setSmallJumps,
  setStopSpeed,
  setTimeScale,
} from "../physics/PlayerMovement.js";
import type { GameServer } from "../server/GameServer.js";
import type { ConsoleEngine } from "./ConsoleEngine.js";
import { SERVER_CVAR_DEFS } from "./serverCVarDefs.js";

const entityTypeNames = () => Object.keys(ENTITY_FACTORIES);

function getCVar(engine: ConsoleEngine, name: string) {
  const cv = engine.cvars.get(name);
  if (!cv) throw new Error(`Server CVar ${name} not registered`);
  return cv;
}

export function registerServerCommands(engine: ConsoleEngine, server: GameServer): void {
  // ── Server CVars (from shared defs) ──
  for (const def of SERVER_CVAR_DEFS) {
    engine.cvars.register(def);
  }

  // ── Wire CVars to server state ──
  const sv_speed = getCVar(engine, "sv_speed");
  server.speedMultiplier = sv_speed.get() as number;
  sv_speed.onChange((val) => {
    server.speedMultiplier = val as number;
  });

  const sv_gravity = getCVar(engine, "sv_gravity");
  setGravityScale(sv_gravity.get() as number);
  sv_gravity.onChange((val) => {
    setGravityScale(val as number);
  });

  const sv_smalljumps = getCVar(engine, "sv_smalljumps");
  setSmallJumps(sv_smalljumps.get() as boolean);
  sv_smalljumps.onChange((val) => {
    setSmallJumps(val as boolean);
  });

  const sv_nobunnyhop = getCVar(engine, "sv_nobunnyhop");
  setNoBunnyHop(sv_nobunnyhop.get() as boolean);
  sv_nobunnyhop.onChange((val) => {
    setNoBunnyHop(val as boolean);
  });

  const sv_platformerair = getCVar(engine, "sv_platformerair");
  setPlatformerAir(sv_platformerair.get() as boolean);
  sv_platformerair.onChange((val) => {
    setPlatformerAir(val as boolean);
  });

  const sv_friction = getCVar(engine, "sv_friction");
  setFriction(sv_friction.get() as number);
  sv_friction.onChange((val) => {
    setFriction(val as number);
  });

  const sv_accelerate = getCVar(engine, "sv_accelerate");
  setAccelerate(sv_accelerate.get() as number);
  sv_accelerate.onChange((val) => {
    setAccelerate(val as number);
  });

  const sv_airaccelerate = getCVar(engine, "sv_airaccelerate");
  setAirAccelerate(sv_airaccelerate.get() as number);
  sv_airaccelerate.onChange((val) => {
    setAirAccelerate(val as number);
  });

  const sv_airwishcap = getCVar(engine, "sv_airwishcap");
  setAirWishCap(sv_airwishcap.get() as number);
  sv_airwishcap.onChange((val) => {
    setAirWishCap(val as number);
  });

  const sv_stopspeed = getCVar(engine, "sv_stopspeed");
  setStopSpeed(sv_stopspeed.get() as number);
  sv_stopspeed.onChange((val) => {
    setStopSpeed(val as number);
  });

  const sv_timescale = getCVar(engine, "sv_timescale");
  server.timeScale = sv_timescale.get() as number;
  setTimeScale(sv_timescale.get() as number);
  sv_timescale.onChange((val) => {
    server.timeScale = val as number;
    setTimeScale(val as number);
  });

  // ── Server Commands ──

  engine.commands.register({
    name: "spawn",
    description: "Spawn entities near the player",
    args: [
      { name: "type", type: "string", completions: entityTypeNames },
      { name: "count", type: "number", optional: true },
    ],
    category: "sv",
    serverSide: true,
    execute: (args, out) => {
      const type = args.type as string;
      const count = (args.count as number | undefined) ?? 1;

      if (!ENTITY_FACTORIES[type]) {
        out(`Unknown entity type: ${type}`);
        out(`Available: ${entityTypeNames().join(", ")}`);
        return;
      }

      const session = getFirstSession(server);
      if (!session) {
        out("No player session");
        return;
      }
      const { wx, wy } = session.player.position;

      for (let i = 0; i < Math.min(count, 500); i++) {
        const ox = (Math.random() - 0.5) * 128;
        const oy = (Math.random() - 0.5) * 128;
        const factory = ENTITY_FACTORIES[type]!;
        const entity = factory(wx + ox, wy + oy);
        server.entityManager.spawn(entity);
      }
      out(`Spawned ${Math.min(count, 500)} ${type}(s)`);
    },
  });

  engine.commands.register({
    name: "kill_all",
    description: "Remove all entities of a type",
    args: [{ name: "type", type: "string", completions: entityTypeNames }],
    category: "sv",
    serverSide: true,
    execute: (args, out) => {
      const type = args.type as string;
      const toRemove = server.entityManager.entities.filter(
        (e) => e.type === type && e.type !== "player",
      );
      for (const e of toRemove) server.entityManager.remove(e.id);
      out(`Removed ${toRemove.length} ${type}(s)`);
    },
  });

  engine.commands.register({
    name: "tp",
    description: "Teleport player to world coordinates",
    args: [
      { name: "x", type: "number" },
      { name: "y", type: "number" },
    ],
    category: "sv",
    serverSide: true,
    execute: (args, out) => {
      const session = getFirstSession(server);
      if (!session) {
        out("No player session");
        return;
      }
      session.player.position.wx = args.x as number;
      session.player.position.wy = args.y as number;
      out(`Teleported to (${args.x}, ${args.y})`);
    },
  });

  engine.commands.register({
    name: "freeze",
    description: "Toggle entity AI pause",
    args: [],
    category: "sv",
    serverSide: true,
    execute: (_args, out) => {
      const session = getFirstSession(server);
      if (!session) {
        out("No player session");
        return;
      }
      session.debugPaused = !session.debugPaused;
      out(`Entity AI: ${session.debugPaused ? "FROZEN" : "running"}`);
    },
  });

  engine.commands.register({
    name: "follow_me",
    description: "Make all befriendable entities follow the player",
    args: [],
    category: "sv",
    serverSide: true,
    execute: (_args, out) => {
      let count = 0;
      for (const e of server.entityManager.entities) {
        if (e.wanderAI?.befriendable && !e.wanderAI.following) {
          e.wanderAI.following = true;
          e.wanderAI.state = "following";
          count++;
        }
      }
      out(`${count} entities now following`);
    },
  });

  engine.commands.register({
    name: "scare",
    description: "Make all entities flee from the player",
    args: [],
    category: "sv",
    serverSide: true,
    execute: (_args, out) => {
      let count = 0;
      for (const e of server.entityManager.entities) {
        if (e.wanderAI && e.type !== "player") {
          e.wanderAI.state = "walking";
          e.wanderAI.following = false;
          count++;
        }
      }
      out(`${count} entities scattered`);
    },
  });

  engine.commands.register({
    name: "entity_count",
    description: "Show entity counts by type",
    args: [],
    category: "sv",
    serverSide: true,
    execute: (_args, out) => {
      const counts = new Map<string, number>();
      for (const e of server.entityManager.entities) {
        counts.set(e.type, (counts.get(e.type) ?? 0) + 1);
      }
      const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
      out(`Total entities: ${server.entityManager.entities.length}`);
      for (const [type, count] of sorted) {
        out(`  ${type}: ${count}`);
      }
    },
  });
  engine.commands.register({
    name: "players",
    description: "List all connected players",
    args: [],
    category: "sv",
    serverSide: true,
    execute: (_args, out) => {
      const now = Date.now();
      const sessions = [...server.getSessions()];
      if (sessions.length === 0) {
        out("No players connected");
        return;
      }
      out(`Players online: ${sessions.length}`);
      for (const s of sessions) {
        const uptime = formatDuration(now - s.connectedAt);
        const dormant = server.isDormant(s.clientId) ? " [dormant]" : "";
        const profile = s.profileId ?? "(none)";
        out(
          `  #${s.playerNumber} ${s.displayName} — profile: ${profile}, connected: ${uptime}${dormant}`,
        );
      }
    },
  });

  engine.commands.register({
    name: "say",
    description: "Broadcast a chat message to all players",
    args: [{ name: "message", type: "string", rest: true }],
    category: "sv",
    serverSide: true,
    execute: (args, out) => {
      const text = args.message as string;
      if (!text) {
        out("Usage: say <message>");
        return;
      }
      const sender = engine.rconSenderName ?? "Server";
      server.broadcastChat(sender, text);
      out(`[${sender}] ${text}`);
    },
  });
}

function getFirstSession(server: GameServer) {
  return server.getFirstSession();
}

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
