/** One asynchronous asset owner. Replaced/evicted/disposed loads cannot publish. */
export class ResourceSlot<T extends { dispose(): void }> {
  value: T | null = null;
  state: "empty" | "loading" | "ready" | "failed" | "disposed" = "empty";
  error: string | null = null;
  private generation = 0;
  async load(loader: () => Promise<T>): Promise<void> {
    if (this.state === "disposed") throw Error("Resource slot is disposed");
    this.reset();
    const generation = this.generation;
    this.state = "loading";
    try {
      const value = await loader();
      if (generation !== this.generation) {
        value.dispose();
        return;
      }
      this.value = value;
      this.state = "ready";
    } catch (error) {
      if (generation === this.generation) {
        this.state = "failed";
        this.error = String(error);
      }
    }
  }
  reset() {
    this.generation++;
    this.value?.dispose();
    this.value = null;
    this.error = null;
    if (this.state !== "disposed") this.state = "empty";
  }
  dispose() {
    this.reset();
    this.state = "disposed";
  }
}
