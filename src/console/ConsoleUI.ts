import type { ConsoleEngine } from "./ConsoleEngine.js";
import type { OutputLine } from "./ConsoleOutput.js";

const CONTAINER_STYLE = `
  position: fixed; top: 0; left: 0; right: 0; height: 25vh;
  background: rgba(10, 10, 30, 0.92);
  font: 13px monospace; color: #ccc;
  z-index: 300; display: none;
  flex-direction: column;
  border-bottom: 2px solid #444;
  transition: transform 0.15s ease-out;
`;

const OUTPUT_STYLE = `
  flex: 1; overflow-y: auto; padding: 8px 12px;
  white-space: pre-wrap; word-break: break-all;
`;

const INPUT_ROW_STYLE = `
  display: flex; align-items: center;
  padding: 4px 12px; border-top: 1px solid #333;
  background: rgba(0, 0, 0, 0.3);
`;

const INPUT_STYLE = `
  flex: 1; background: transparent; border: none; outline: none;
  color: #0f0; font: 13px monospace;
  caret-color: #0f0;
`;

const COMPLETION_STYLE = `
  position: absolute; bottom: 100%; left: 12px;
  background: rgba(20, 20, 40, 0.95);
  border: 1px solid #555; border-radius: 2px;
  max-height: 200px; overflow-y: auto;
  display: none; font: 13px monospace;
`;

const COMPLETION_ITEM_STYLE = `
  padding: 2px 8px; cursor: pointer;
`;

interface CompletionSession {
  baseInput: string;
  replaceStart: number;
  replaceEnd: number;
  values: string[];
  index: number;
  isNameCompletion: boolean;
  typedToken: string;
}

export class ConsoleUI {
  private container: HTMLDivElement;
  private outputEl: HTMLDivElement;
  private inputEl: HTMLInputElement;
  private completionEl: HTMLDivElement;
  private engine: ConsoleEngine;
  private unsubLine: (() => void) | null = null;
  private completionSession: CompletionSession | null = null;

  constructor(engine: ConsoleEngine) {
    this.engine = engine;

    this.container = document.createElement("div");
    this.container.style.cssText = CONTAINER_STYLE;

    this.outputEl = document.createElement("div");
    this.outputEl.style.cssText = OUTPUT_STYLE;

    const inputRow = document.createElement("div");
    inputRow.style.cssText = INPUT_ROW_STYLE;
    inputRow.style.position = "relative";

    const prompt = document.createElement("span");
    prompt.textContent = "] ";
    prompt.style.color = "#0f0";

    this.inputEl = document.createElement("input");
    this.inputEl.type = "text";
    this.inputEl.style.cssText = INPUT_STYLE;
    this.inputEl.autocomplete = "off";
    this.inputEl.spellcheck = false;

    this.completionEl = document.createElement("div");
    this.completionEl.style.cssText = COMPLETION_STYLE;

    inputRow.append(prompt, this.inputEl, this.completionEl);
    this.container.append(this.outputEl, inputRow);
    document.body.appendChild(this.container);

    // Block game input while console is open
    const stop = (e: Event) => e.stopPropagation();
    this.container.addEventListener("keydown", stop);
    this.container.addEventListener("keyup", stop);
    this.container.addEventListener("keypress", stop);

    this.inputEl.addEventListener("keydown", (e) => this.handleKey(e));

    // Render existing output lines
    for (const line of engine.output.getLines()) {
      this.appendLine(line);
    }

    // Subscribe to new lines
    this.unsubLine = engine.output.onLine((line) => this.appendLine(line));
  }

  get visible(): boolean {
    return this.container.style.display !== "none";
  }

  show(): void {
    this.container.style.display = "flex";
    this.inputEl.focus();
    this.scrollToBottom();
  }

  hide(): void {
    this.container.style.display = "none";
    this.hideCompletions();
    this.inputEl.blur();
  }

  toggle(): void {
    if (this.visible) this.hide();
    else this.show();
  }

  focus(): void {
    this.inputEl.focus();
  }

  destroy(): void {
    this.unsubLine?.();
    this.container.remove();
  }

  private appendLine(line: OutputLine): void {
    const el = document.createElement("div");
    el.textContent = line.text;
    el.style.color = line.color;
    this.outputEl.appendChild(el);
    this.scrollToBottom();
  }

  private scrollToBottom(): void {
    this.outputEl.scrollTop = this.outputEl.scrollHeight;
  }

  private handleKey(e: KeyboardEvent): void {
    switch (e.key) {
      case "Enter":
        e.preventDefault();
        this.submitInput();
        break;

      case "Tab":
        e.preventDefault();
        this.tabComplete(e.shiftKey);
        break;

      case "ArrowUp":
        e.preventDefault();
        this.navigateHistory("up");
        break;

      case "ArrowDown":
        e.preventDefault();
        this.navigateHistory("down");
        break;

      case "Escape":
        e.preventDefault();
        this.hide();
        break;

      case "`":
        e.preventDefault();
        this.hide();
        break;

      default:
        // Reset completions on typing
        this.hideCompletions();
        break;
    }
  }

  private submitInput(): void {
    const text = this.inputEl.value;
    this.inputEl.value = "";
    this.hideCompletions();
    if (text.trim()) {
      this.engine.exec(text);
    }
  }

  private tabComplete(reverse: boolean): void {
    let session = this.completionSession;
    if (!session) {
      session = this.createCompletionSession();
      this.completionSession = session;
      if (!session || session.values.length === 0) return;
    }

    if (session.values.length === 1) {
      this.applyCompletion(session, session.values[0]!, true);
      this.hideCompletions();
      return;
    }

    // First Tab with multiple matches: expand to the longest shared prefix
    // before switching into candidate cycling.
    if (session.index < 0) {
      const lcp = longestCommonPrefix(session.values);
      if (lcp.length > session.typedToken.length) {
        this.applyCompletion(session, lcp, false);
      }
      this.showCompletions();
      return;
    }

    // Cycle through explicit candidates.
    if (reverse) {
      session.index = session.index <= 0 ? session.values.length - 1 : session.index - 1;
    } else {
      session.index = (session.index + 1) % session.values.length;
    }

    this.showCompletions();
    this.applyCompletion(session, session.values[session.index]!, true);
  }

  private createCompletionSession(): CompletionSession | null {
    const input = this.inputEl.value;
    const cursor = this.inputEl.selectionStart ?? input.length;
    const replaceStart = findTokenStart(input, cursor);
    const replaceEnd = findTokenEnd(input, cursor);
    const detail = this.engine.completeDetailed(input.slice(0, cursor));
    if (detail.values.length === 0) return null;

    const rawToken = detail.currentToken;
    const typedToken = (detail.isNameCompletion ? stripSlash(rawToken) : rawToken).toLowerCase();
    return {
      baseInput: input,
      replaceStart,
      replaceEnd,
      values: detail.values,
      index: -1,
      isNameCompletion: detail.isNameCompletion,
      typedToken,
    };
  }

  private applyCompletion(session: CompletionSession, value: string, finalized: boolean): void {
    const before = session.baseInput.slice(0, session.replaceStart);
    const after = session.baseInput.slice(session.replaceEnd);
    const token = session.isNameCompletion ? `/${value}` : value;
    const needsSpace = finalized && (after.length === 0 || !/^\s/.test(after));
    const insert = needsSpace ? `${token} ` : token;
    this.inputEl.value = `${before}${insert}${after}`;
    const caret = before.length + insert.length;
    this.inputEl.selectionStart = this.inputEl.selectionEnd = caret;
  }

  private showCompletions(): void {
    const session = this.completionSession;
    if (!session || session.values.length === 0) {
      this.completionEl.style.display = "none";
      return;
    }
    this.completionEl.innerHTML = "";
    for (let i = 0; i < Math.min(session.values.length, 20); i++) {
      const item = document.createElement("div");
      item.style.cssText = COMPLETION_ITEM_STYLE;
      item.textContent = session.values[i]!;
      if (i === session.index) {
        item.style.background = "#336";
        item.style.color = "#fff";
      } else {
        item.style.color = "#aaa";
      }
      const idx = i;
      item.addEventListener("mousedown", (e) => {
        e.preventDefault();
        if (!this.completionSession) return;
        this.applyCompletion(this.completionSession, this.completionSession.values[idx]!, true);
        this.hideCompletions();
        this.inputEl.focus();
      });
      this.completionEl.appendChild(item);
    }
    if (session.values.length > 20) {
      const more = document.createElement("div");
      more.style.cssText = COMPLETION_ITEM_STYLE;
      more.style.color = "#666";
      more.textContent = `... and ${session.values.length - 20} more`;
      this.completionEl.appendChild(more);
    }
    this.completionEl.style.display = "block";
  }

  private hideCompletions(): void {
    this.completionEl.style.display = "none";
    this.completionSession = null;
  }

  private navigateHistory(dir: "up" | "down"): void {
    const val = dir === "up" ? this.engine.historyUp() : this.engine.historyDown();
    if (val != null) {
      this.inputEl.value = val;
      // Move cursor to end
      requestAnimationFrame(() => {
        this.inputEl.selectionStart = this.inputEl.selectionEnd = this.inputEl.value.length;
      });
    }
  }
}

function stripSlash(name: string): string {
  return name.startsWith("/") ? name.slice(1) : name;
}

function longestCommonPrefix(values: readonly string[]): string {
  if (values.length === 0) return "";
  let prefix = values[0]!;
  for (let i = 1; i < values.length; i++) {
    const next = values[i]!;
    let j = 0;
    const len = Math.min(prefix.length, next.length);
    while (j < len && prefix[j] === next[j]) j++;
    prefix = prefix.slice(0, j);
    if (prefix.length === 0) break;
  }
  return prefix;
}

function findTokenStart(input: string, cursor: number): number {
  let i = Math.max(0, Math.min(cursor, input.length));
  while (i > 0 && !isWhitespace(input[i - 1]!)) i--;
  return i;
}

function findTokenEnd(input: string, cursor: number): number {
  let i = Math.max(0, Math.min(cursor, input.length));
  while (i < input.length && !isWhitespace(input[i]!)) i++;
  return i;
}

function isWhitespace(ch: string): boolean {
  return ch === " " || ch === "\t" || ch === "\n" || ch === "\r";
}
