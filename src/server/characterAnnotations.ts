import { createHash } from "node:crypto";
import type { ArtCatalog } from "../art/ArtCatalog.js";
import { parseArtNote } from "../art/ArtNotes.js";
import { CHARACTERS, parseCharacterSettings } from "../characters/CharacterCatalog.js";
import type { WorkshopCandidate, WorkshopEvent } from "../workshop/WorkshopTypes.js";
import { HttpError } from "./workshopAuth.js";

export function characterAnnotation(
  e: Extract<WorkshopEvent, { type: "character" }>,
  catalog: ArtCatalog,
  candidates: WorkshopCandidate[],
  current: boolean,
  createdAt: string,
) {
  const c = candidates.find((c) => c.kind === "character" && c.id === e.candidateId);
  const def = CHARACTERS.find((d) => d.id === c?.characterId);
  const sheet = catalog.sheets.find((s) => s.id === def?.sheetKey);
  if (
    !current ||
    !c ||
    !def ||
    !sheet ||
    c.fingerprint !== e.fingerprint ||
    c.sourceFingerprint !== sheet.fingerprint
  )
    throw new HttpError(409, "Character candidate changed. Reload before reviewing.");
  if (
    !["note", "approved", "changes"].includes(e.verdict) ||
    typeof e.note !== "string" ||
    e.note.length > 3500 ||
    (e.verdict === "changes" && !e.note.trim())
  )
    throw new HttpError(
      400,
      "Needs changes requires a reason; notes must be at most 3500 characters.",
    );
  const settings = parseCharacterSettings(e.settings);
  const settingsFingerprint = createHash("sha256")
    .update(JSON.stringify({ candidate: c.fingerprint, settings }))
    .digest("hex");
  return parseArtNote(
    {
      id: e.id,
      threadId: e.id,
      createdAt,
      sheetId: sheet.id,
      fingerprint: sheet.fingerprint,
      sheetSize: [sheet.width, sheet.height],
      rect: [0, 0, sheet.width, sheet.height],
      sliceKeys: [],
      intent: "other",
      status: e.verdict === "approved" ? "resolved" : "pending",
      note:
        e.note.trim() ||
        (e.verdict === "approved"
          ? "Approved this character and exact settings."
          : "Saved character settings for review."),
      reply: "",
      characterAnnotation: {
        candidateId: c.id,
        candidateFingerprint: c.fingerprint,
        settings,
        settingsFingerprint,
        verdict: e.verdict,
        createdAt,
      },
    },
    catalog,
  );
}
