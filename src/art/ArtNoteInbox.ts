import { workshopFetch } from "../workshop/AuthClient.js";
import type { ArtCatalog } from "./ArtCatalog.js";
import { type ArtNote, latestArtNotes, parseArtNote } from "./ArtNotes.js";

/** Shared persistent outbox and transport for source and prefab review tools. */
export class ArtNoteInbox {
  readonly outbox: ArtNote[];
  records: ArtNote[];
  message = "";
  storageProblem = "";
  onchange = () => {};
  private flushing = false;
  private refreshPending = false;
  constructor(
    private catalog: ArtCatalog,
    private storageKey: string,
  ) {
    let stored: { outbox?: unknown[]; records?: unknown[] } = {};
    try {
      const value = JSON.parse(localStorage.getItem(storageKey) ?? "{}");
      if (value && typeof value === "object" && !Array.isArray(value)) stored = value;
    } catch {
      /* Ignore corrupt cache. */
    }
    const parse = (rows: unknown[]) =>
      rows.flatMap((row) => {
        try {
          return [parseArtNote(row, catalog)];
        } catch {
          return [];
        }
      });
    this.outbox = parse(Array.isArray(stored.outbox) ? stored.outbox : []);
    this.records = parse(Array.isArray(stored.records) ? stored.records : []);
  }
  get notes(): ArtNote[] {
    return latestArtNotes([...this.records, ...this.outbox]);
  }
  get status(): string {
    return (
      this.storageProblem ||
      (this.outbox.length
        ? `${this.outbox.length} note event(s) pending server save${this.message ? ` · ${this.message}` : ""}`
        : this.message || "All notes saved on this machine.")
    );
  }
  private persist() {
    try {
      const previous = JSON.parse(localStorage.getItem(this.storageKey) ?? "{}");
      localStorage.setItem(
        this.storageKey,
        JSON.stringify({ ...previous, outbox: this.outbox, records: this.records }),
      );
      this.storageProblem = "";
    } catch {
      this.storageProblem =
        "Browser storage is full. Keep this page open until the note reaches the server.";
    }
  }
  enqueue(value: ArtNote): void {
    this.outbox.push(parseArtNote(value, this.catalog));
    this.message = "";
    this.persist();
    this.onchange();
    void this.sync();
  }
  async sync(): Promise<void> {
    if (this.flushing) {
      this.refreshPending = true;
      return;
    }
    this.flushing = true;
    const request = async (init?: RequestInit) => {
      const response = await workshopFetch("/tilefun/api/art-notes", init);
      if (!response.ok) throw new Error(`Server returned ${response.status}`);
      return response.json();
    };
    try {
      while (this.outbox[0]) {
        const row = this.outbox[0];
        await request({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(row),
        });
        // A successful POST is durable even if the following GET goes offline.
        this.records = latestArtNotes([...this.records, row]);
        this.outbox.shift();
        this.persist();
      }
      this.records = ((await request()) as unknown[]).map((row) => parseArtNote(row, this.catalog));
      this.persist();
      this.message = "Server inbox up to date.";
    } catch (error) {
      this.message = `will retry · ${error instanceof Error ? error.message : "offline"}`;
    } finally {
      this.flushing = false;
      this.onchange();
      if (this.refreshPending) {
        this.refreshPending = false;
        void this.sync();
      }
    }
  }
}
