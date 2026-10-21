import { actionHint, inputHint } from "../input/InputHints.js";
import { activateMenu, deactivateMenu, focusMenu } from "./MenuNavigation.js";

/** Shared contextual actions: touch launcher, keyboard shortcut and gamepad focus. */
export class ContextActions {
  readonly button = document.createElement("button");
  readonly dialog = document.createElement("dialog");
  private title = document.createElement("h2");
  private help = document.createElement("p");
  private closeButton = document.createElement("button");
  private target = "";
  private available = false;
  private opener: HTMLElement | null = null;

  constructor(
    readonly content: HTMLElement,
    private changed: () => void = () => {},
  ) {
    this.button.type = "button";
    this.button.dataset.contextActions = "";
    this.button.hidden = true;
    this.button.style.cssText =
      "position:fixed;right:20px;bottom:calc(198px + env(safe-area-inset-bottom));z-index:80;width:64px;min-height:52px;padding:4px;border:1px solid #c5d3b6;border-radius:14px;background:#243a32;color:white;font:13px sans-serif;cursor:pointer";
    this.button.onclick = () => this.toggle();
    this.dialog.dataset.testid = "context-actions";
    this.dialog.setAttribute("aria-label", "Vehicle actions");
    this.dialog.style.cssText =
      "margin:auto;width:min(340px,calc(100vw - 48px));max-height:calc(100dvh - 48px);box-sizing:border-box;overflow:auto;padding:20px;border:1px solid #c5d3b6;border-radius:16px;background:#243a32;color:white;font:16px sans-serif";
    this.title.style.cssText = "font-size:20px;margin:0 0 12px";
    this.content.style.cssText = "display:flex;flex-direction:column;gap:8px";
    this.help.style.cssText = "font-size:13px;line-height:1.5;margin:12px 0";
    this.closeButton.type = "button";
    this.closeButton.textContent = "Back";
    this.closeButton.style.cssText =
      "width:100%;min-height:48px;font:inherit;border-radius:8px;cursor:pointer";
    this.closeButton.onclick = () => this.close();
    this.dialog.append(this.title, this.content, this.help, this.closeButton);
    this.dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      this.close();
    });
    // MenuNavigation owns keyboard navigation in capture. Other keys must not
    // reach gameplay or remain held after a confirmation closes this dialog.
    this.dialog.addEventListener("keydown", (event) => event.stopPropagation());
    this.dialog.addEventListener("keyup", (event) => event.stopPropagation());
    document.body.append(this.button, this.dialog);
    window.addEventListener("blur", this.close);
    document.addEventListener("visibilitychange", this.visibility);
  }

  get open(): boolean {
    return this.dialog.open;
  }

  update(title: string, target: string, available: boolean, locked: boolean): void {
    if (target !== this.target || !available || locked) this.close();
    this.target = target;
    this.available = available && !locked;
    this.button.hidden = !available;
    this.button.style.display = this.button.hidden ? "none" : "";
    this.button.disabled = locked || !available;
    const hint = actionHint("context_actions");
    this.button.textContent = `Actions${hint ? ` · ${hint}` : ""}`;
    this.title.textContent = title;
    this.help.textContent =
      inputHint(
        "Arrows: choose · Enter: select · Escape: back",
        "D-pad / stick: choose · A: select · B: back",
      ) || "Choose an action, or tap Back.";
    if (this.open && this.dialog.contains(document.activeElement)) {
      const active = document.activeElement as HTMLElement;
      if (active.closest("[hidden]") || active.matches(":disabled")) focusMenu(this.dialog);
    }
  }

  toggle(): boolean {
    if (this.open) {
      this.close();
      return true;
    }
    if (!this.available) return false;
    this.opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.changed();
    this.dialog.showModal();
    activateMenu(this.dialog, this.close);
    this.button.setAttribute("aria-expanded", "true");
    return true;
  }

  close = (): void => {
    if (!this.open) return;
    deactivateMenu(this.dialog);
    this.dialog.close();
    this.button.setAttribute("aria-expanded", "false");
    this.changed();
    this.opener?.focus({ preventScroll: true });
  };

  private visibility = (): void => {
    if (document.hidden) this.close();
  };

  destroy(): void {
    this.close();
    window.removeEventListener("blur", this.close);
    document.removeEventListener("visibilitychange", this.visibility);
    this.dialog.remove();
    this.button.remove();
  }
}
