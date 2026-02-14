import type { CVarCategory } from "./CVar.js";

export interface CommandArg {
  name: string;
  type: "string" | "number" | "boolean";
  optional?: boolean;
  /** If true (only valid on the last string arg), consumes all remaining tokens. */
  rest?: boolean;
  completions?: () => string[];
}

export type OutputFn = (text: string) => void;

export interface CommandDesc {
  name: string;
  description: string;
  args: CommandArg[];
  category: CVarCategory;
  /** If true, this command executes on the server via rcon. */
  serverSide?: boolean;
  execute: (args: Record<string, string | number | boolean>, output: OutputFn) => void;
}
