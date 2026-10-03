import { PERSISTENCE_BUDGET } from "../persistence/PersistenceBudget.js";

/** Ordered, bounded commands waiting on readiness. Ordinary input never waits here. */
export class MutationQueue {
  private tail: Promise<void> = Promise.resolve();
  count = 0;
  run(ready: boolean, prepare: () => Promise<void>, mutate: () => void): Promise<void> | undefined {
    if (!this.count && ready) {
      mutate();
      return;
    }
    if (this.count >= PERSISTENCE_BUDGET.editQueue)
      throw new Error("Too many edits are waiting for world data. Try again shortly.");
    this.count++;
    const operation = this.tail.then(async () => {
      await prepare();
      mutate();
    });
    this.tail = operation
      .then(
        () => {},
        () => {},
      )
      .finally(() => {
        this.count--;
      });
    return operation;
  }
  async drain(): Promise<void> {
    await this.tail;
  }
}
