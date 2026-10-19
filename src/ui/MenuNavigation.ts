import {
  CONTROLLER_EVENT,
  type ControllerCommand,
  controllerInput,
} from "../input/ControllerInput.js";
import { controllerPointer } from "../input/ControllerPointer.js";

const menus = new Map<HTMLElement, { back: () => void; order: number }>();
let order = 0;
const visible = (e: HTMLElement) =>
  !e.closest("[hidden], [inert]") && e.getClientRects().length > 0;
function activeMenu(): HTMLElement | undefined {
  return [...menus]
    .filter(([e]) => e.isConnected && visible(e))
    .sort((a, b) => b[1].order - a[1].order)[0]?.[0];
}
function controls(root: HTMLElement): HTMLElement[] {
  return [
    ...root.querySelectorAll<HTMLElement>(
      "button, a[href], input, textarea, select, summary, [tabindex='0']",
    ),
  ].filter((e) => visible(e) && !e.matches(":disabled") && e.tabIndex >= 0);
}
export function focusMenu(root: HTMLElement): void {
  (controls(root)[0] ?? root).focus();
}
export function activateMenu(root: HTMLElement, back: () => void, focus = true): void {
  root.dataset.menuRoot = "true";
  menus.set(root, { back, order: ++order });
  if (focus) focusMenu(root);
}
export function deactivateMenu(root: HTMLElement): void {
  menus.delete(root);
}

function move(root: HTMLElement, direction: ControllerCommand): void {
  const items = controls(root);
  const current = document.activeElement as HTMLElement;
  if (!items.includes(current)) {
    focusMenu(root);
    return;
  }
  if (
    (direction === "left" || direction === "right") &&
    (current instanceof HTMLSelectElement || current instanceof HTMLInputElement)
  ) {
    const delta = direction === "left" ? -1 : 1;
    if (current instanceof HTMLSelectElement)
      current.selectedIndex = Math.max(
        0,
        Math.min(current.options.length - 1, current.selectedIndex + delta),
      );
    else if (["number", "range"].includes(current.type))
      delta < 0 ? current.stepDown() : current.stepUp();
    else return;
    current.dispatchEvent(new Event("change", { bubbles: true }));
    return;
  }
  const rect = current.getBoundingClientRect();
  const x = rect.x + rect.width / 2,
    y = rect.y + rect.height / 2;
  const vertical = direction === "up" || direction === "down";
  const sign = direction === "up" || direction === "left" ? -1 : 1;
  const next = items
    .filter((e) => e !== current)
    .map((e) => {
      const r = e.getBoundingClientRect();
      const dx = r.x + r.width / 2 - x,
        dy = r.y + r.height / 2 - y;
      const along = (vertical ? dy : dx) * sign,
        across = Math.abs(vertical ? dx : dy);
      return { e, along, score: along + across * 3 };
    })
    .filter((v) => v.along > 2)
    .sort((a, b) => a.score - b.score)[0]?.e;
  if (next) {
    next.focus();
    next.scrollIntoView({ block: "nearest", inline: "nearest" });
  }
}

/** On-screen text entry keeps names, PINs and join links possible with only a pad. */
function textKeyboard(input: HTMLInputElement | HTMLTextAreaElement): void {
  const dialog = document.createElement("dialog");
  dialog.className = "text-keyboard";
  dialog.setAttribute(
    "aria-label",
    input.getAttribute("aria-label") ?? input.placeholder ?? "Type text",
  );
  const preview = document.createElement("p");
  const grid = document.createElement("div");
  grid.className = "keyboard-grid";
  let uppercase = false;
  let value = input.value;
  const update = () => {
    preview.textContent =
      input.type === "password" ? "•".repeat(value.length) : value || "Type with the buttons below";
  };
  const add = (label: string, click: () => void) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.onclick = click;
    grid.append(b);
    return b;
  };
  const letters: HTMLButtonElement[] = [];
  for (const char of "1234567890qwertyuiopasdfghjklzxcvbnm-_.:/?=&@") {
    const b = add(char, () => {
      if (input.maxLength < 0 || value.length < input.maxLength)
        value += uppercase ? char.toUpperCase() : char;
      update();
    });
    letters.push(b);
  }
  add("Space", () => {
    value += " ";
    update();
  });
  add("⌫", () => {
    value = value.slice(0, -1);
    update();
  });
  add("Clear", () => {
    value = "";
    update();
  });
  add("Shift", () => {
    uppercase = !uppercase;
    for (const b of letters)
      b.textContent = uppercase
        ? (b.textContent?.toUpperCase() ?? "")
        : (b.textContent?.toLowerCase() ?? "");
  });
  const close = () => {
    deactivateMenu(dialog);
    dialog.close();
    dialog.remove();
    input.focus();
  };
  add("Done", () => {
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    close();
  });
  add("Cancel", close);
  dialog.append(preview, grid);
  document.body.append(dialog);
  dialog.showModal();
  update();
  dialog.oncancel = (e) => {
    e.preventDefault();
    close();
  };
  activateMenu(dialog, close);
}

function navigate(command: ControllerCommand, controller: boolean): boolean {
  const root = activeMenu();
  if (!root) return false;
  if (command === "back" || command === "menu") menus.get(root)?.back();
  else if (["up", "down", "left", "right"].includes(command)) move(root, command);
  else if (command === "confirm") {
    const current = document.activeElement as HTMLElement;
    if (!root.contains(current)) focusMenu(root);
    else if (
      controller &&
      (current instanceof HTMLInputElement || current instanceof HTMLTextAreaElement) &&
      !["checkbox", "radio", "range"].includes(current.type)
    )
      textKeyboard(current);
    else if (current instanceof HTMLSelectElement) move(root, "right");
    else current.click();
  }
  return true;
}

controllerInput.uiActive = () => !!activeMenu();
controllerPointer.activateControl = (element) => {
  if (
    (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) &&
    !["checkbox", "radio", "range"].includes(element.type)
  )
    textKeyboard(element);
  else if (element instanceof HTMLSelectElement) {
    element.selectedIndex = (element.selectedIndex + 1) % element.options.length;
    element.dispatchEvent(new Event("change", { bubbles: true }));
  } else element.click();
};
if (typeof window !== "undefined") {
  window.addEventListener(
    CONTROLLER_EVENT,
    (event) => {
      if (navigate((event as CustomEvent<ControllerCommand>).detail, true)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true,
  );
  window.addEventListener(
    "keydown",
    (event) => {
      const root = activeMenu();
      if (!root) return;
      if (event.key === "Tab") {
        const items = controls(root),
          current = items.indexOf(document.activeElement as HTMLElement);
        const next = items[(current + (event.shiftKey ? -1 : 1) + items.length) % items.length];
        next?.focus();
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      // Canvas tools retain their own keyboard pan/zoom commands.
      if (event.target instanceof HTMLCanvasElement && !["Escape", "Tab"].includes(event.key))
        return;
      const text =
        event.target instanceof HTMLTextAreaElement ||
        (event.target instanceof HTMLInputElement &&
          !["checkbox", "radio"].includes(event.target.type));
      const commands: Record<string, ControllerCommand> = {
        ArrowUp: "up",
        ArrowDown: "down",
        ArrowLeft: "left",
        ArrowRight: "right",
        Escape: "back",
      };
      if (text && event.key !== "Escape") return;
      const command = commands[event.key];
      if (command && navigate(command, false)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true,
  );
}
