/** The HTML shell is visible before the application dependency graph downloads. */
let finished = false;

export function showStartupStage(stage: string, title: string, detail: string): void {
  if (finished) return;
  const screen = document.getElementById("startup-screen");
  if (!screen) return;
  screen.hidden = false;
  screen.dataset.stage = stage;
  const label = document.getElementById("startup-stage");
  const description = document.getElementById("startup-detail");
  if (label && label.textContent !== title) label.textContent = title;
  if (description) description.textContent = detail;
  document.getElementById("startup-progress")?.removeAttribute("value");
}

export function showStartupAssets(completed: number, total: number): void {
  if (finished) return;
  const progress = document.getElementById("startup-progress") as HTMLProgressElement | null;
  const description = document.getElementById("startup-detail");
  if (progress) {
    progress.max = total;
    progress.value = completed;
  }
  if (description)
    description.textContent =
      completed < total
        ? `${completed} of ${total} images ready`
        : "Images ready · finishing sounds and tile data…";
}

/** Profile selection and multiplayer connection dialogs own their visible progress. */
export function suspendStartup(): void {
  const screen = document.getElementById("startup-screen");
  if (screen) screen.hidden = true;
}

export function finishStartup(): void {
  if (finished) return;
  finished = true;
  const screen = document.getElementById("startup-screen");
  if (screen) screen.setAttribute("aria-busy", "false");
  suspendStartup();
}

export function failStartup(error: unknown): void {
  showStartupStage(
    "failed",
    "Couldn’t load Tilefun",
    error instanceof Error ? error.message : String(error),
  );
  const progress = document.getElementById("startup-progress");
  if (progress) progress.hidden = true;
  const retry = document.getElementById("startup-retry") as HTMLButtonElement | null;
  if (retry) {
    retry.hidden = false;
    retry.onclick = () => location.reload();
  }
}
