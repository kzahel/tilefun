import type { DevUpdate } from "../shared/devUpdates.js";

/** Passive notice: it never opens a menu or takes focus away from play. */
export class DevUpdateNotice {
  private readonly element = document.createElement("div");
  private readonly status = document.createElement("span");
  private readonly reload = document.createElement("button");
  private readonly events: EventSource;
  private baseline: string | undefined;
  private pending = false;
  private busy = false;

  constructor(
    private readonly onChange: (label: string | null) => void,
    private readonly saveAndReload: () => Promise<void>,
  ) {
    this.element.dataset.testid = "dev-update-notice";
    this.element.hidden = true;
    this.element.style.cssText = `position:fixed;top:64px;left:50%;transform:translateX(-50%);
      z-index:150;background:rgba(10,10,30,.92);color:#fff;border:1px solid #8cf;
      border-radius:6px;padding:8px 12px;font:13px sans-serif;max-width:85vw;`;
    this.status.setAttribute("role", "status");
    this.reload.type = "button";
    this.reload.textContent = "Save and reload";
    this.reload.style.cssText = "margin-left:8px;padding:6px;cursor:pointer;";
    this.reload.onclick = () => void this.requestReload();
    this.element.append(this.status, this.reload);
    document.body.append(this.element);
    this.events = new EventSource(`${import.meta.env.BASE_URL}__dev-updates`);
    this.events.onmessage = (event) => {
      const update: DevUpdate = JSON.parse(event.data);
      if (this.baseline === undefined) {
        this.baseline = update.revision;
        return;
      }
      if (update.revision !== this.baseline) this.pending = true;
      if (!this.pending) return;
      const label =
        update.state === "ready"
          ? "Changes ready to try"
          : update.state === "editing"
            ? "Code changing…"
            : "Code changed";
      this.onChange(`${label} · Save and reload`);
      if (this.busy) return;
      this.status.textContent = `${label} · Menu for controller`;
      // Clear stale readiness immediately; only announce ordinary edits once settled.
      if (update.state !== "editing") this.element.hidden = false;
    };
  }

  async requestReload(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.reload.disabled = true;
    this.status.textContent = "Saving…";
    try {
      await this.saveAndReload();
    } catch (error) {
      this.status.textContent = `Couldn't save: ${String(error)}`;
      this.element.hidden = false;
      this.busy = false;
      this.reload.disabled = false;
    }
  }

  destroy(): void {
    this.events.close();
    this.element.remove();
    this.onChange(null);
  }
}
