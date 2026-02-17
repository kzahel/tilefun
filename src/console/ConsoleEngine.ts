import type { OutputFn } from "./Command.js";
import { CommandRegistry } from "./CommandRegistry.js";
import { ConsoleOutput } from "./ConsoleOutput.js";
import { CVarRegistry } from "./CVarRegistry.js";

const MAX_HISTORY = 100;

export class ConsoleEngine {
  readonly cvars = new CVarRegistry();
  readonly commands = new CommandRegistry();
  readonly output = new ConsoleOutput();
  private history: string[] = [];
  private historyIndex = -1;

  /**
   * If set, called for commands with serverSide=true.
   * Returns a promise that resolves with output lines from the server.
   */
  rconSend: ((command: string) => Promise<string[]>) | null = null;

  /** Set by the rcon handler before execServer() so commands can identify the caller. */
  rconSenderName: string | null = null;

  constructor() {
    this.registerBuiltins();
  }

  exec(input: string): void {
    const trimmed = input.trim();
    if (!trimmed) return;

    // Add to history
    if (this.history[this.history.length - 1] !== trimmed) {
      this.history.push(trimmed);
      if (this.history.length > MAX_HISTORY) this.history.shift();
    }
    this.historyIndex = -1;

    this.output.print(`] ${trimmed}`);

    // Bare text (no / prefix) → chat
    if (!trimmed.startsWith("/")) {
      if (this.rconSend) {
        this.rconSend(`say ${trimmed}`)
          .then((lines) => {
            for (const line of lines) this.output.print(line);
          })
          .catch((e) => {
            this.output.printError(`chat error: ${e instanceof Error ? e.message : String(e)}`);
          });
      } else {
        this.output.printError("Not connected");
      }
      return;
    }

    // /prefixed → command or cvar
    const tokens = tokenize(trimmed);
    const name = stripSlash(tokens[0]!.toLowerCase());
    const args = tokens.slice(1);

    // Check if it's a cvar get/set
    const cv = this.cvars.get(name);
    if (cv) {
      // Server CVars: forward via rcon so the server applies the change
      if (cv.category === "sv" && this.rconSend) {
        this.rconSend(trimmed.slice(1))
          .then((lines) => {
            for (const line of lines) this.output.print(line);
          })
          .catch((e) => {
            this.output.printError(`rcon error: ${e instanceof Error ? e.message : String(e)}`);
          });
        return;
      }
      if (args.length === 0) {
        this.output.print(cv.toString());
      } else {
        cv.setFromString(args[0]!);
        this.output.print(`${cv.name} = ${String(cv.get())}`);
      }
      return;
    }

    // Check if it's a command
    const cmd = this.commands.get(name);
    if (cmd) {
      if (cmd.serverSide && this.rconSend) {
        this.rconSend(trimmed.slice(1))
          .then((lines) => {
            for (const line of lines) this.output.print(line);
          })
          .catch((e) => {
            this.output.printError(`rcon error: ${e instanceof Error ? e.message : String(e)}`);
          });
        return;
      }
      const out: OutputFn = (text) => this.output.print(text);
      this.commands.execute(name, args, out);
      return;
    }

    // Not found locally — forward to server via rcon (handles sv_* cvars etc.)
    if (this.rconSend) {
      this.rconSend(trimmed.slice(1))
        .then((lines) => {
          for (const line of lines) this.output.print(line);
        })
        .catch((e) => {
          this.output.printError(`rcon error: ${e instanceof Error ? e.message : String(e)}`);
        });
      return;
    }

    this.output.printError(`Unknown command: ${name}`);
  }

  /** Execute directly on the server side (for rcon handler). */
  execServer(input: string): string[] {
    const lines: string[] = [];
    const out: OutputFn = (text) => lines.push(text);

    const trimmed = input.trim();
    if (!trimmed) return lines;

    const tokens = tokenize(trimmed);
    const name = stripSlash(tokens[0]!.toLowerCase());
    const args = tokens.slice(1);

    const cv = this.cvars.get(name);
    if (cv) {
      if (args.length === 0) {
        lines.push(cv.toString());
      } else {
        cv.setFromString(args[0]!);
        lines.push(`${cv.name} = ${String(cv.get())}`);
      }
      return lines;
    }

    if (this.commands.execute(name, args, out)) return lines;

    lines.push(`Unknown command: ${name}`);
    return lines;
  }

  completeDetailed(partial: string): {
    values: string[];
    isNameCompletion: boolean;
    currentToken: string;
  } {
    const tokens = tokenizeForCompletion(partial);

    // Completing the command/cvar name.
    if (tokens.length <= 1) {
      const currentToken = tokens[0] ?? "";
      const prefix = stripSlash(currentToken.toLowerCase());
      const cvarMatches = this.cvars.getNames().filter((n) => n.startsWith(prefix));
      const cmdMatches = this.commands.getCompletions(prefix);
      return {
        values: [...new Set([...cmdMatches, ...cvarMatches])].sort(),
        isNameCompletion: true,
        currentToken,
      };
    }

    // Completing an argument.
    const cmdName = stripSlash(tokens[0]!.toLowerCase());
    const argIndex = tokens.length - 2; // -1 for cmd name, -1 for current partial
    const currentToken = tokens[tokens.length - 1] ?? "";
    const argPartial = currentToken.toLowerCase();

    const cv = this.cvars.get(cmdName);
    if (cv) {
      return {
        values: this.getCVarValueCompletions(cv, argIndex, argPartial),
        isNameCompletion: false,
        currentToken,
      };
    }

    return {
      values: this.commands.getArgCompletions(cmdName, argIndex, currentToken),
      isNameCompletion: false,
      currentToken,
    };
  }

  complete(partial: string): string[] {
    return this.completeDetailed(partial).values;
  }

  historyUp(): string | null {
    if (this.history.length === 0) return null;
    if (this.historyIndex < 0) this.historyIndex = this.history.length;
    this.historyIndex = Math.max(0, this.historyIndex - 1);
    return this.history[this.historyIndex] ?? null;
  }

  historyDown(): string | null {
    if (this.historyIndex < 0) return null;
    this.historyIndex++;
    if (this.historyIndex >= this.history.length) {
      this.historyIndex = -1;
      return "";
    }
    return this.history[this.historyIndex] ?? null;
  }

  private registerBuiltins(): void {
    this.commands.register({
      name: "help",
      description: "Show help for a command, or list all commands",
      args: [
        {
          name: "command",
          type: "string",
          optional: true,
          completions: () => this.commands.getNames(),
        },
      ],
      category: "cl",
      execute: (args, out) => {
        const name = args.command as string | undefined;
        if (name) {
          const cmd = this.commands.get(name);
          if (cmd) {
            const argStr = cmd.args
              .map((a) => (a.optional ? `[${a.name}]` : `<${a.name}>`))
              .join(" ");
            out(`${cmd.name} ${argStr}`);
            out(`  ${cmd.description}`);
            if (cmd.serverSide) out("  (server-side, sent via rcon)");
            return;
          }
          const cv = this.cvars.get(name);
          if (cv) {
            out(cv.toString());
            return;
          }
          out(`Unknown: ${name}`);
          return;
        }
        out("Commands:");
        for (const cmd of this.commands.getAll()) {
          const argStr = cmd.args
            .map((a) => (a.optional ? `[${a.name}]` : `<${a.name}>`))
            .join(" ");
          out(`  ${cmd.name} ${argStr} -- ${cmd.description}`);
        }
        const cvarNames = this.cvars.getNames();
        if (cvarNames.length > 0) {
          out(`CVars: ${cvarNames.join(", ")}`);
          out('  Type a cvar name to see its value, or "cvarname value" to set it.');
        }
      },
    });

    this.commands.register({
      name: "clear",
      description: "Clear console output",
      args: [],
      category: "cl",
      execute: (_args, _out) => {
        this.output.clear();
      },
    });

    this.commands.register({
      name: "find",
      description: "Search commands and cvars by substring",
      args: [{ name: "pattern", type: "string" }],
      category: "cl",
      execute: (args, out) => {
        const pat = (args.pattern as string).toLowerCase();
        let found = 0;
        for (const cmd of this.commands.getAll()) {
          if (cmd.name.includes(pat) || cmd.description.toLowerCase().includes(pat)) {
            out(`  cmd: ${cmd.name} -- ${cmd.description}`);
            found++;
          }
        }
        for (const cv of this.cvars.getAll()) {
          if (cv.name.includes(pat) || cv.description.toLowerCase().includes(pat)) {
            out(`  cvar: ${cv.toString()}`);
            found++;
          }
        }
        if (found === 0) out(`No matches for "${pat}"`);
      },
    });

    this.commands.register({
      name: "cvarlist",
      description: "List all cvars, optionally filtered by category",
      args: [
        {
          name: "category",
          type: "string",
          optional: true,
          completions: () => ["cl", "sv", "r", "fun"],
        },
      ],
      category: "cl",
      execute: (args, out) => {
        const cat = args.category as string | undefined;
        const all = cat
          ? this.cvars.getAll().filter((cv) => cv.category === cat)
          : this.cvars.getAll();
        if (all.length === 0) {
          out(cat ? `No cvars in category: ${cat}` : "No cvars registered");
          return;
        }
        for (const cv of all) out(`  ${cv.toString()}`);
      },
    });

    this.commands.register({
      name: "reset",
      description: "Reset a cvar to its default value",
      args: [{ name: "cvar", type: "string", completions: () => this.cvars.getNames() }],
      category: "cl",
      execute: (args, out) => {
        const cv = this.cvars.get(args.cvar as string);
        if (!cv) {
          out(`Unknown cvar: ${args.cvar}`);
          return;
        }
        cv.reset();
        out(`${cv.name} reset to ${String(cv.defaultValue)}`);
      },
    });

    this.commands.register({
      name: "resetall",
      description: "Reset all cvars to defaults",
      args: [],
      category: "cl",
      execute: (_args, out) => {
        this.cvars.resetAll();
        out("All cvars reset to defaults");
      },
    });
  }

  private getCVarValueCompletions(
    cv: import("./CVar.js").CVar,
    argIndex: number,
    partialLower: string,
  ): string[] {
    // CVar console syntax only has one argument (the value).
    if (argIndex > 0) return [];
    if (cv.type === "boolean") {
      return ["0", "1", "true", "false"].filter((s) => s.startsWith(partialLower));
    }
    if (cv.type === "number") {
      const options = new Set<string>([String(cv.get()), String(cv.defaultValue)]);
      if (cv.min !== undefined) options.add(String(cv.min));
      if (cv.max !== undefined) options.add(String(cv.max));
      return [...options].filter((s) => s.toLowerCase().startsWith(partialLower));
    }
    return [];
  }
}

/** Strip an optional leading '/' so `/say` is treated the same as `say`. */
function stripSlash(name: string): string {
  return name.startsWith("/") ? name.slice(1) : name;
}

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let inQuote = false;

  for (const ch of input) {
    if (ch === '"') {
      inQuote = !inQuote;
      continue;
    }
    if (ch === " " && !inQuote) {
      if (current) tokens.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  if (current) tokens.push(current);
  return tokens;
}

function tokenizeForCompletion(input: string): string[] {
  const noLeading = input.replace(/^\s+/, "");
  if (noLeading.length === 0) return [];
  const hasTrailingWhitespace = /\s$/.test(noLeading);
  const tokens = tokenize(noLeading);
  if (hasTrailingWhitespace) tokens.push("");
  return tokens;
}
