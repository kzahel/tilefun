import { MAX_ELEVATION } from "../config/constants.js";
import { ELEVATION_COLORS, ELEVATION_GRID_SIZES } from "./EditorPalettes.js";
import {
  BTN_STYLE,
  type EditorSection,
  type EditorSectionHost,
  highlight,
  makeLabel,
  makeRow,
  makeSeparator,
} from "./EditorPanelWidgets.js";

/** Elevation tab: target height and paint grid size. */
export class EditorElevationPalette implements EditorSection {
  readonly rows: readonly HTMLElement[];
  private readonly elevationRow = makeRow();
  private readonly elevationHeightButtons: HTMLButtonElement[] = [];
  private readonly elevationGridButtons: HTMLButtonElement[] = [];

  constructor(private readonly host: EditorSectionHost) {
    this.elevationRow.appendChild(makeLabel("Height"));
    for (let h = 0; h <= MAX_ELEVATION; h++) {
      const height = h;
      const btn = this.squareButton(
        `${h}`,
        h === 0 ? "Flatten (height 0)" : `Set height ${h}`,
        () => {
          host.model.selectedElevation = height;
        },
      );
      btn.style.background = ELEVATION_COLORS[h] ?? "#888";
      this.elevationHeightButtons.push(btn);
    }

    this.elevationRow.appendChild(makeSeparator());
    this.elevationRow.appendChild(makeLabel("Grid"));
    for (const size of ELEVATION_GRID_SIZES) {
      const btn = this.squareButton(`${size}x${size}`, `Paint ${size}x${size} tile area`, () => {
        host.model.elevationGridSize = size;
      });
      this.elevationGridButtons.push(btn);
    }

    this.elevationRow.appendChild(makeSeparator());
    const elevHint = document.createElement("span");
    elevHint.style.cssText = "font: 10px monospace; color: #aaa;";
    elevHint.textContent = "Click: set height / Right-click: flatten";
    this.elevationRow.appendChild(elevHint);
    this.rows = [this.elevationRow];
  }

  private squareButton(text: string, title: string, select: () => void): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.style.cssText = BTN_STYLE;
    btn.style.width = "44px";
    btn.textContent = text;
    btn.title = title;
    btn.addEventListener("click", () => {
      select();
      this.host.sync();
    });
    this.elevationRow.appendChild(btn);
    return btn;
  }

  sync(): void {
    const model = this.host.model;
    this.elevationRow.style.display = model.editorTab === "elevation" ? "flex" : "none";
    for (const [i, btn] of this.elevationHeightButtons.entries())
      highlight(btn, i === model.selectedElevation);
    for (const [i, btn] of this.elevationGridButtons.entries())
      highlight(btn, ELEVATION_GRID_SIZES[i] === model.elevationGridSize);
  }
}
