import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useLocation } from "react-router";
import type { ArtNote } from "../art/ArtNotes.js";
import { ErrorMessage, threadPath } from "./App.js";
import { workshopJson } from "./AuthClient.js";
import { familyNoteEvent, familyNoteTarget } from "./FamilySheetNotes.js";
import type { FamilyMember, FamilySheet, FamilySheetCatalog } from "./FamilySheetTypes.js";
import { useSession } from "./WorkshopQueries.js";
import { useWorkspace } from "./WorkspaceStore.js";

export function FamilySheetNote({
  catalog,
  family,
  member,
  variantId,
  imagesReady,
}: {
  catalog: FamilySheetCatalog;
  family: FamilySheet;
  member: FamilyMember | null;
  variantId: string;
  imagesReady: boolean;
}) {
  const session = useSession();
  const location = useLocation();
  const draftKey = `family:${family.id}:${family.revision}:${member?.id ?? "all"}:${variantId}`;
  const draft = useWorkspace((s) => s.drafts[draftKey] ?? "");
  const [savedKey, setSavedKey] = useState("");
  const [error, setError] = useState("");
  const requestedRevision = new URLSearchParams(location.search).get("revision");
  const stale = requestedRevision !== null && requestedRevision !== family.revision;
  const notes = useQuery({
    queryKey: ["workshop", "art-notes"],
    queryFn: () => workshopJson<ArtNote[]>("art-notes"),
    enabled: session.data?.authenticated === true,
    refetchInterval: 30_000,
  });
  const currentNotes =
    notes.data?.filter((note) => {
      const target = familyNoteTarget(note.sliceKeys);
      return (
        target?.family === family.id &&
        target.revision === family.revision &&
        (!member || target.member === member.id)
      );
    }) ?? [];
  return (
    <div className="family-note">
      {session.data?.authenticated ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!imagesReady || stale) return;
            try {
              useWorkspace
                .getState()
                .enqueue(
                  familyNoteEvent(catalog, family, member, variantId, draft, crypto.randomUUID()),
                );
              useWorkspace.getState().setDraft(draftKey, "");
              setSavedKey(draftKey);
              setError("");
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : String(cause));
            }
          }}
        >
          <label>
            {member ? `Note about ${member.label}` : `Note about ${family.name}`}
            <textarea
              value={draft}
              rows={3}
              maxLength={2000}
              placeholder="What should we know about these pieces?"
              onChange={(e) => {
                useWorkspace.getState().setDraft(draftKey, e.target.value);
                setSavedKey("");
              }}
            />
          </label>
          <button type="submit" disabled={!imagesReady || stale || !draft.trim()}>
            Save note
          </button>
          {savedKey === draftKey ? <p role="status">Note queued for the shared inbox.</p> : null}
          {stale ? (
            <Link
              to={`/tool/families?${new URLSearchParams({ family: family.id, ...(member ? { member: member.id } : {}), variant: variantId })}`}
            >
              Open current proposal to leave a note
            </Link>
          ) : null}
        </form>
      ) : (
        <Link to={`/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`}>
          Sign in to leave a note
        </Link>
      )}
      <ErrorMessage error={error || notes.error} />
      {currentNotes.length ? (
        <ul>
          {currentNotes.map((note) => (
            <li key={note.threadId}>
              <Link to={threadPath(`art:${note.threadId}`)}>
                {note.note.split("\n\n").slice(1).join("\n\n") || note.note}
              </Link>
              {note.reply ? <p>{note.reply}</p> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
