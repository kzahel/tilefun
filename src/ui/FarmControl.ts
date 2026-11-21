import "./FarmControl.css";
import type { FarmChoice, FarmRequest } from "../farming/FarmInteraction.js";
import { inputHint, keyboardHint } from "../input/InputHints.js";
import { type PageInset, shift } from "../input/ViewRect.js";

function targetKey(request: FarmRequest | null | undefined): string {
  return request
    ? "entityId" in request
      ? `actor:${request.entityId}`
      : `prop:${request.propId}`
    : "";
}

export class FarmControl {
  private readonly root = document.createElement("div");
  private readonly button = document.createElement("button");
  private readonly text = document.createElement("p");
  private choice: FarmChoice | undefined;
  private busy = false;
  private feedback = "";

  constructor(private readonly send: (request: FarmRequest) => Promise<unknown>) {
    this.root.className = "farm-control";
    this.root.hidden = true;
    this.button.type = "button";
    this.button.onclick = () => this.activate();
    this.text.setAttribute("role", "status");
    this.root.append(this.button, this.text);
    document.body.append(this.root);
  }

  update(choice: FarmChoice | undefined): void {
    if (
      targetKey(choice?.request) !== targetKey(this.choice?.request) ||
      choice?.label !== this.choice?.label
    )
      this.feedback = "";
    this.choice = choice;
    this.root.hidden = !choice;
    this.button.hidden = !choice?.request;
    this.button.disabled = this.busy;
    const hint = inputHint(keyboardHint("enter_place"), "Y");
    const label = choice?.request ? [choice.label, hint].filter(Boolean).join(" · ") : "";
    if (this.button.textContent !== label) this.button.textContent = label;
    const status = this.feedback || (choice?.request ? "" : (choice?.label ?? ""));
    if (this.text.textContent !== status) this.text.textContent = status;
    this.text.hidden = !status;
  }

  activate(): void {
    const { choice } = this;
    const request = choice?.request;
    if (!request || this.busy) return;
    this.busy = true;
    this.feedback = "";
    void this.send(request)
      .catch((error: Error) => {
        if (targetKey(this.choice?.request) === targetKey(request)) this.feedback = error.message;
      })
      .finally(() => {
        this.busy = false;
      });
  }

  place(inset: PageInset): void {
    shift(this.root, inset.left, -inset.bottom);
  }

  destroy(): void {
    this.root.remove();
  }
}
