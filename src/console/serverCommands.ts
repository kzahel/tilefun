import { ENTITY_FACTORIES } from "../entities/EntityFactories.js";
import type { GameServer } from "../server/GameServer.js";
import type { ConsoleEngine } from "./ConsoleEngine.js";

const entityTypeNames = () => Object.keys(ENTITY_FACTORIES);

export function registerServerCommands(engine: ConsoleEngine, server: GameServer): void {
  // ── Server CVars ──

  engine.cvars.register<number>({
    name: "sv_tickrate",
    description: "Server tick rate (Hz)",
    type: "number",
    defaultValue: 60,
    min: 1,
    max: 240,
    category: "sv",
  });

  const sv_speed = engine.cvars.register<number>({
    name: "sv_speed",
    description: "Player speed multiplier",
    type: "number",
    defaultValue: 1,
    min: 0.1,
    max: 20,
    category: "sv",
  });

  // Make sv_speed accessible from server tick
  server.speedMultiplier = sv_speed.get();
  sv_speed.onChange((val) => {
    server.speedMultiplier = val;
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
