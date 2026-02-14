export interface OutputLine {
  text: string;
  color: string;
  timestamp: number;
}

const MAX_LINES = 1000;

export class ConsoleOutput {
  private lines: OutputLine[] = [];
  private listener: ((line: OutputLine) => void) | null = null;

  print(text: string, color = "#ccc"): void {
    const line: OutputLine = { text, color, timestamp: performance.now() };
    this.lines.push(line);
    if (this.lines.length > MAX_LINES) this.lines.shift();
    this.listener?.(line);
  }

  printError(text: string): void {
    this.print(text, "#ff4444");
  }

  printWarning(text: string): void {
    this.print(text, "#ffcc00");
  }

  printInfo(text: string): void {
    this.print(text, "#66ccff");
  }

  getLines(): readonly OutputLine[] {
    return this.lines;
  }

  clear(): void {
    this.lines.length = 0;
  }

  onLine(cb: (line: OutputLine) => void): () => void {
    this.listener = cb;
    return () => {
      if (this.listener === cb) this.listener = null;
    };
  }
}
