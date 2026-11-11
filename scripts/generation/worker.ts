import { type Options, runBenchmark } from "./workload.js";

// An isolated diagnostic Worker, never the game's UI thread or persistent world.
self.onmessage = (event: MessageEvent<Options>) => {
  void runBenchmark(event.data).then(
    (report) => self.postMessage({ report }),
    (error: unknown) =>
      self.postMessage({ error: error instanceof Error ? error.stack : String(error) }),
  );
};
