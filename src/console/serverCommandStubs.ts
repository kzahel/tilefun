import { ENTITY_FACTORIES } from "../entities/EntityFactories.js";
import type { ConsoleEngine } from "./ConsoleEngine.js";
import { SERVER_CVAR_DEFS } from "./serverCVarDefs.js";

const entityTypeNames = () => Object.keys(ENTITY_FACTORIES);

/**
 * Register server-side command and CVar stubs on the client for help text and
 * tab completion. These are never executed locally — the ConsoleEngine forwards
 * them to the server via rcon.
 */
export function registerServerCommandStubs(engine: ConsoleEngine): void {
  const noop = () => {};

  // Server CVar stubs (autocomplete + help; actual values live on the server)
  for (const def of SERVER_CVAR_DEFS) {
    engine.cvars.register(def);
  }

  engine.commands.register({
    name: "spawn",
    description: "Spawn entities near the player",
    args: [
      { name: "type", type: "string", completions: entityTypeNames },
      { name: "count", type: "number", optional: true },
    ],
    category: "sv",
    serverSide: true,
    execute: noop,
  });

  engine.commands.register({
    name: "kill_all",
    description: "Remove all entities of a type",
    args: [{ name: "type", type: "string", completions: entityTypeNames }],
    category: "sv",
    serverSide: true,
    execute: noop,
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
    execute: noop,
  });

  engine.commands.register({
    name: "freeze",
    description: "Toggle entity AI pause",
    args: [],
    category: "sv",
    serverSide: true,
    execute: noop,
  });

  engine.commands.register({
    name: "follow_me",
    description: "Make all befriendable entities follow the player",
    args: [],
    category: "sv",
    serverSide: true,
    execute: noop,
  });

  engine.commands.register({
    name: "scare",
    description: "Make all entities flee from the player",
    args: [],
    category: "sv",
    serverSide: true,
    execute: noop,
  });

  engine.commands.register({
    name: "entity_count",
    description: "Show entity counts by type",
    args: [],
    category: "sv",
    serverSide: true,
    execute: noop,
  });

  engine.commands.register({
    name: "say",
    description: "Broadcast a chat message to all players",
    args: [{ name: "message", type: "string", rest: true }],
    category: "sv",
    serverSide: true,
    execute: noop,
  });
}
