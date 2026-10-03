import { CHARACTERS, type CharacterSettings, parseCharacterSettings } from "./CharacterCatalog.js";

export interface CharacterAnnotation {
  candidateId: string;
  candidateFingerprint: string;
  settings: CharacterSettings;
  settingsFingerprint: string;
  verdict: "note" | "approved" | "changes";
  createdAt: string;
}
export function parseCharacterAnnotation(value: unknown): CharacterAnnotation {
  if (!value || typeof value !== "object") throw new Error("Invalid character annotation");
  const v = value as CharacterAnnotation;
  if (
    !CHARACTERS.some((c) => `character:${c.id}` === v.candidateId) ||
    !/^[a-f0-9]{64}$/.test(v.candidateFingerprint) ||
    !/^[a-f0-9]{64}$/.test(v.settingsFingerprint) ||
    !["note", "approved", "changes"].includes(v.verdict) ||
    typeof v.createdAt !== "string" ||
    v.createdAt.length > 40 ||
    !Number.isFinite(Date.parse(v.createdAt))
  )
    throw new Error("Invalid character annotation");
  return {
    candidateId: v.candidateId,
    candidateFingerprint: v.candidateFingerprint,
    settings: parseCharacterSettings(v.settings),
    settingsFingerprint: v.settingsFingerprint,
    verdict: v.verdict,
    createdAt: v.createdAt,
  };
}
