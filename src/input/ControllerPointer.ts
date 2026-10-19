/** One screen-space cursor for shared DOM tools and world editing. */
class ControllerPointer {
  worldActive = false;
  active = false;
  x = 0;
  y = 0;
  overUI = false;
  claimed = false;
  activateControl: (element: HTMLElement) => void = (element) => element.click();
  private element: HTMLDivElement | undefined;
  private previousTime = 0;
  private pressed = false;
  private initialized = false;
  reset(): void {
    this.active = false;
    this.overUI = false;
    this.pressed = false;
    this.claimed = false;
    this.previousTime = 0;
    if (this.element) this.element.hidden = true;
  }
  update(
    dx: number,
    dy: number,
    now: number,
    select: boolean,
    ui: boolean,
    reveal = false,
  ): boolean {
    if (typeof document === "undefined" || (!ui && !this.worldActive)) {
      this.reset();
      return false;
    }
    if (!this.initialized) {
      this.x = innerWidth * 0.5;
      this.y = innerHeight * 0.35;
      this.initialized = true;
      window.addEventListener("keydown", () => this.reset());
      window.addEventListener("pointerdown", (event) => {
        if (event.isTrusted) this.reset();
      });
      window.addEventListener("pointermove", (event) => {
        if (event.isTrusted && event.pointerType === "mouse") this.reset();
      });
    }
    const dt = this.previousTime ? Math.min(0.05, (now - this.previousTime) / 1000) : 0;
    this.previousTime = now;
    if (!select) this.claimed = false;
    if (dx || dy || ((select || reveal) && this.worldActive)) this.active = true;
    if (!this.active) {
      this.pressed = select;
      return false;
    }
    this.x = Math.max(0, Math.min(innerWidth - 1, this.x + dx * dt * 600));
    this.y = Math.max(0, Math.min(innerHeight - 1, this.y + dy * dt * 600));
    if (!this.element) {
      this.element = document.createElement("div");
      this.element.dataset.testid = "controller-pointer";
      this.element.setAttribute("aria-hidden", "true");
      this.element.style.cssText =
        "position:fixed;pointer-events:none;z-index:20000;width:18px;height:18px;border:2px solid #ffe69b;border-radius:50%;transform:translate(-50%,-50%);box-shadow:0 0 0 2px #172731";
      document.body.append(this.element);
    }
    this.element.hidden = false;
    this.element.style.left = `${this.x}px`;
    this.element.style.top = `${this.y}px`;
    const hit = document.elementFromPoint(this.x, this.y);
    // Overflowing palettes remain reachable without switching to a mouse wheel.
    for (let parent = hit?.parentElement; parent; parent = parent.parentElement) {
      const rect = parent.getBoundingClientRect();
      if (
        parent.scrollWidth > parent.clientWidth &&
        ((dx > 0 && this.x > rect.right - 28) || (dx < 0 && this.x < rect.left + 28))
      )
        parent.scrollLeft += dx * dt * 500;
      if (
        parent.scrollHeight > parent.clientHeight &&
        ((dy > 0 && this.y > rect.bottom - 28) || (dy < 0 && this.y < rect.top + 28))
      )
        parent.scrollTop += dy * dt * 500;
    }
    this.overUI = !!hit && !hit.matches("#game");
    const control = hit?.closest<HTMLElement>(
      "button, a[href], input, select, textarea, summary, [data-controller-point]",
    );
    const usable = control && !control.matches(":disabled") && !control.closest("[inert]");
    if (usable && (dx || dy)) control.focus({ preventScroll: true });
    if (usable && select && !this.pressed) {
      this.claimed = true;
      control.focus({ preventScroll: true });
      if (control.hasAttribute("data-controller-point"))
        control.dispatchEvent(
          new CustomEvent("controller-point", { detail: { x: this.x, y: this.y } }),
        );
      else this.activateControl(control);
    }
    this.pressed = select;
    return this.claimed;
  }
}
export const controllerPointer = new ControllerPointer();
