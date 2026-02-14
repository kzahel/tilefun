import type { CommandArg, CommandDesc, OutputFn } from "./Command.js";

export class CommandRegistry {
  private commands = new Map<string, CommandDesc>();

  register(desc: CommandDesc): void {
    this.commands.set(desc.name, desc);
  }

  get(name: string): CommandDesc | undefined {
    return this.commands.get(name);
  }

  getAll(): CommandDesc[] {
    return [...this.commands.values()];
  }

  getNames(): string[] {
    return [...this.commands.keys()];
  }

  execute(name: string, tokens: string[], output: OutputFn): boolean {
    const cmd = this.commands.get(name);
    if (!cmd) return false;

    const parsed = parseArgs(cmd.args, tokens, output);
    if (!parsed) return true; // parse error already reported

    try {
      cmd.execute(parsed, output);
    } catch (e) {
      output(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
    return true;
  }

  getCompletions(partial: string): string[] {
    const lower = partial.toLowerCase();
    return this.getNames().filter((n) => n.startsWith(lower));
  }

  /** Get argument completions for a specific command. */
  getArgCompletions(name: string, argIndex: number, partial: string): string[] {
    const cmd = this.commands.get(name);
    if (!cmd || argIndex >= cmd.args.length) return [];
    const arg = cmd.args[argIndex];
    if (!arg?.completions) {
      if (arg?.type === "boolean")
        return ["0", "1", "true", "false"].filter((s) => s.startsWith(partial));
      return [];
    }
    const lower = partial.toLowerCase();
    return arg.completions().filter((s) => s.toLowerCase().startsWith(lower));
  }
}

function parseArgs(
  schema: CommandArg[],
  tokens: string[],
  output: OutputFn,
): Record<string, string | number | boolean> | null {
  const result: Record<string, string | number | boolean> = {};

  for (let i = 0; i < schema.length; i++) {
    const arg = schema[i]!;
    const raw = tokens[i];

    if (raw == null) {
      if (arg.optional) continue;
      output(`Missing required argument: ${arg.name}`);
      return null;
    }

    switch (arg.type) {
      case "number": {
        const n = Number(raw);
        if (Number.isNaN(n)) {
          output(`Expected number for ${arg.name}, got: ${raw}`);
          return null;
        }
        result[arg.name] = n;
        break;
      }
      case "boolean":
        result[arg.name] = raw === "1" || raw === "true";
        break;
      case "string":
        if (arg.rest) {
          // Consume all remaining tokens joined by space
          result[arg.name] = [raw, ...tokens.slice(i + 1)].join(" ");
          return result;
        }
        result[arg.name] = raw;
        break;
    }
  }

  return result;
}
