import {
  BTN_STYLE,
  type EditorSection,
  type EditorSectionHost,
  makeLabel,
  makeRow,
} from "./EditorPanelWidgets.js";

const ROOM_TOOLS = [
  ["Floor", "L", false],
  ["Kitchen floor", "K", false],
  ["Wall", "#", false],
  ["Door", "+", false],
  ["Room rectangle", "L", true],
] as const;

function patternButton(text: string, onclick: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.textContent = text;
  button.style.cssText = BTN_STYLE;
  button.onclick = onclick;
  return button;
}

/**
 * Patterns tab: the fenced-trees row outdoors; indoors it becomes the live room
 * editor (room tools row above the shared pattern row).
 */
export class EditorPatternPalette implements EditorSection {
  readonly rows: readonly HTMLElement[];
  private readonly roomRow = makeRow();
  private readonly roomButtons: { button: HTMLButtonElement; value: string; rectangle: boolean }[] =
    [];
  private readonly patternRow = makeRow();
  private readonly patternLabel = makeLabel("Fenced trees v1 · candidate");
  private readonly patternUndo: HTMLButtonElement;
  private readonly patternRedo: HTMLButtonElement;
  private readonly studio = document.createElement("a");
  private readonly patternStatus = document.createElement("span");

  constructor(private readonly host: EditorSectionHost) {
    const model = host.model;
    for (const [label, value, rectangle] of ROOM_TOOLS) {
      const button = patternButton(label, () => {
        model.roomValue = value;
        model.roomRectangle = rectangle;
        model.setPaintMode("positive");
      });
      this.roomButtons.push({ button, value, rectangle });
      this.roomRow.appendChild(button);
    }
    this.patternLabel.dataset.patternLabel = "true";
    this.patternRow.appendChild(this.patternLabel);
    this.patternRow.appendChild(
      patternButton("Paint / erase", () =>
        model.setPaintMode(model.paintMode === "positive" ? "unpaint" : "positive"),
      ),
    );
    this.patternUndo = patternButton("Undo row stroke", () => model.onPatternHistory?.("undo"));
    this.patternRow.appendChild(this.patternUndo);
    this.patternRedo = patternButton("Redo row stroke", () => model.onPatternHistory?.("redo"));
    this.patternRow.appendChild(this.patternRedo);
    this.studio.href = "/tilefun/workshop.html#/tool/patterns?family=fenced-trees-v1";
    this.studio.textContent = "Pattern studio ↗";
    this.studio.style.color = "#8cf";
    this.patternRow.appendChild(this.studio);
    this.patternStatus.setAttribute("role", "status");
    this.patternRow.appendChild(this.patternStatus);
    this.rows = [this.roomRow, this.patternRow];
  }

  sync(): void {
    const model = this.host.model;
    const indoor = model.indoor;
    this.patternRow.style.display = model.editorTab === "patterns" ? "flex" : "none";
    this.roomRow.style.display = indoor && model.editorTab === "patterns" ? "flex" : "none";
    for (const { button, value, rectangle } of this.roomButtons)
      button.style.borderColor =
        model.roomValue === value && model.roomRectangle === rectangle ? "#8cf" : "#888";
    this.patternLabel.textContent = indoor
      ? "Live room · 32px grid"
      : "Fenced trees v1 · candidate";
    this.patternUndo.textContent = indoor ? "Undo room stroke" : "Undo row stroke";
    this.patternRedo.textContent = indoor ? "Redo room stroke" : "Redo row stroke";
    this.studio.href = `/tilefun/workshop.html#/tool/patterns?family=${indoor ? "rooms-v1" : "fenced-trees-v1"}`;
    this.patternStatus.textContent = model.patternError || this.patternHint();
    this.patternStatus.style.color = model.patternError ? "#ffa090" : "#ccc";
    this.patternUndo.disabled = !model.patternCanUndo;
    this.patternRedo.disabled = !model.patternCanRedo;
  }

  private patternHint(): string {
    const model = this.host.model;
    return model.indoor
      ? `${model.paintMode === "unpaint" ? "Erase" : "Draw"}: drag on the room. Right click erases; Shift/middle drag pans. Street entrance is protected. Move furniture clear before changing its floor.`
      : `${model.paintMode === "unpaint" ? "Erase" : "Paint"}: drag a horizontal row (4–128 cells). Right click erases. Fence faces south.`;
  }
}
