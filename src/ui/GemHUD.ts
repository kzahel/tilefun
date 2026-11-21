import type { Entity } from "../entities/Entity.js";
import type { FarmBasket } from "../farming/FarmActors.js";
import { farmBasketLabel } from "../farming/FarmInteraction.js";
import "./GemHUD.css";

/** Persistent player progress, independent of scene and world renderer. */
export class GemHUD {
  private readonly element = document.createElement("div");
  private readonly icon = document.createElement("canvas");
  private readonly count = document.createElement("span");
  private readonly buddies = document.createElement("span");
  private readonly basket = document.createElement("span");
  private lastBasket: FarmBasket | undefined;
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
    this.basket.className = "farm-basket";
    this.basket.dataset.testid = "farm-basket";
    this.basket.hidden = true;
    this.element.append(this.icon, label, this.count, this.buddies, this.basket);
    document.body.append(this.element);
  }

  setIcon(sprite: HTMLCanvasElement): void {
    this.icon.getContext("2d")?.drawImage(sprite, 0, 0, 16, 16, 0, 0, 16, 16);
  }

  /** Seat 0's gems and following buddies; hidden while split-screen views draw each
   * seat's own badge (226). */
  present(
    state: {
      gemsCollected: number;
      entities: readonly Entity[];
      farmBasket?: FarmBasket | undefined;
    },
    shown: boolean,
  ): void {
    if (!shown) {
      this.element.hidden = true;
      return;
    }
    let buddies = 0;
    for (const entity of state.entities) if (entity.wanderAI?.following) buddies++;
    this.update(state.gemsCollected, buddies, state.farmBasket);
  }

  update(gems: number, buddies: number, basket?: FarmBasket): void {
    this.element.hidden = false;
    if (gems === this.lastGems && buddies === this.lastBuddies && basket === this.lastBasket)
      return;
    this.lastBasket = basket;
    this.basket.hidden = !basket;
    this.basket.textContent = farmBasketLabel(basket);
    this.lastGems = gems;
    this.lastBuddies = buddies;
    this.count.textContent = gems.toLocaleString();
    this.buddies.hidden = buddies === 0;
    this.buddies.textContent = buddies ? `♥ ${buddies}` : "";
    this.element.setAttribute(
      "aria-label",
      `Gems: ${gems}${buddies ? `; Buddies: ${buddies}` : ""}${basket ? `; Corn: ${basket.corn}; Wood: ${basket.wood}` : ""}`,
    );
  }

  destroy(): void {
    this.element.remove();
  }
}
