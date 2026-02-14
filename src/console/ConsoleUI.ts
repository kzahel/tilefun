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

export class ConsoleUI {
  private container: HTMLDivElement;
  private outputEl: HTMLDivElement;
  private inputEl: HTMLInputElement;
  private completionEl: HTMLDivElement;
  private engine: ConsoleEngine;
  private unsubLine: (() => void) | null = null;
  private completions: string[] = [];
  private completionIndex = -1;

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
    const text = this.inputEl.value;
    if (!text.trim()) {
      // Show all commands
      this.completions = this.engine.complete("");
      this.completionIndex = -1;
      this.showCompletions();
      return;
    }

    if (this.completions.length === 0 || this.completionIndex < 0) {
      this.completions = this.engine.complete(text);
      this.completionIndex = -1;
    }

    if (this.completions.length === 0) return;

    if (this.completions.length === 1) {
      this.applyCompletion(this.completions[0]!);
      this.hideCompletions();
      return;
    }

    // Cycle through
    if (reverse) {
      this.completionIndex =
        this.completionIndex <= 0 ? this.completions.length - 1 : this.completionIndex - 1;
    } else {
      this.completionIndex = (this.completionIndex + 1) % this.completions.length;
    }

    this.showCompletions();
    this.applyCompletion(this.completions[this.completionIndex]!);
  }

  private applyCompletion(value: string): void {
    const tokens = this.inputEl.value.split(" ");
    if (tokens.length === 1) {
      // Completing command name — prefix with / to distinguish from chat
      this.inputEl.value = `/${value} `;
    } else {
      tokens[tokens.length - 1] = value;
      this.inputEl.value = tokens.join(" ");
    }
  }

  private showCompletions(): void {
    this.completionEl.innerHTML = "";
    for (let i = 0; i < Math.min(this.completions.length, 20); i++) {
      const item = document.createElement("div");
      item.style.cssText = COMPLETION_ITEM_STYLE;
      item.textContent = this.completions[i]!;
      if (i === this.completionIndex) {
        item.style.background = "#336";
        item.style.color = "#fff";
      } else {
        item.style.color = "#aaa";
      }
      const idx = i;
      item.addEventListener("mousedown", (e) => {
        e.preventDefault();
        this.applyCompletion(this.completions[idx]!);
        this.hideCompletions();
        this.inputEl.focus();
      });
      this.completionEl.appendChild(item);
    }
    if (this.completions.length > 20) {
      const more = document.createElement("div");
      more.style.cssText = COMPLETION_ITEM_STYLE;
      more.style.color = "#666";
      more.textContent = `... and ${this.completions.length - 20} more`;
      this.completionEl.appendChild(more);
    }
    this.completionEl.style.display = this.completions.length > 0 ? "block" : "none";
  }

  private hideCompletions(): void {
    this.completionEl.style.display = "none";
    this.completions = [];
    this.completionIndex = -1;
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
