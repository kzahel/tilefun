import "./GemHUD.css";

/** Persistent player progress, independent of scene and world renderer. */
export class GemHUD {
  private readonly element = document.createElement("div");
  private readonly icon = document.createElement("canvas");
  private readonly count = document.createElement("span");
  private readonly buddies = document.createElement("span");
  private lastGems = -1;
  private lastBuddies = -1;

  constructor() {
    this.element.className = "gem-hud";
    this.element.dataset.testid = "gem-hud";
    this.element.setAttribute("role", "status");
    this.element.setAttribute("aria-live", "polite");
    this.element.setAttribute("aria-atomic", "true");
    this.element.hidden = true;
    this.icon.width = this.icon.height = 16;
    this.icon.setAttribute("aria-hidden", "true");
    const label = document.createElement("span");
    label.textContent = "Gems";
    this.count.dataset.testid = "gem-count";
    this.buddies.className = "gem-hud-buddies";
    this.buddies.hidden = true;
    this.element.append(this.icon, label, this.count, this.buddies);
    document.body.append(this.element);
  }

  setIcon(sprite: HTMLCanvasElement): void {
    this.icon.getContext("2d")?.drawImage(sprite, 0, 0, 16, 16, 0, 0, 16, 16);
  }

  update(gems: number, buddies: number): void {
    this.element.hidden = false;
    if (gems === this.lastGems && buddies === this.lastBuddies) return;
    this.lastGems = gems;
    this.lastBuddies = buddies;
    this.count.textContent = gems.toLocaleString();
    this.buddies.hidden = buddies === 0;
    this.buddies.textContent = buddies ? `♥ ${buddies}` : "";
    this.element.setAttribute(
      "aria-label",
      `Gems: ${gems}${buddies ? `; Buddies: ${buddies}` : ""}`,
    );
  }

  destroy(): void {
    this.element.remove();
  }
}
