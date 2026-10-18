interface Window {
  tilefunDesktop?: {
    quit(): void;
    onPrepareQuit(callback: () => void): void;
    finishQuit(error?: string): void;
  };
}
