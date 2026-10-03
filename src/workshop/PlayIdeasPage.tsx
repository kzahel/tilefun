import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { speakIdea } from "../ideas/IdeaSpeech.js";
import type { IdeaStatus, PlayIdea } from "../ideas/PlayIdea.js";
import { workshopJson } from "./AuthClient.js";

type IdeaList = { total: number; ideas: Omit<PlayIdea, "screenshot">[] };
export default function PlayIdeasPage() {
  const client = useQueryClient();
  const [offset, setOffset] = useState(0),
    [selected, setSelected] = useState<string | null>(null);
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [deleting, setDeleting] = useState(false);
  const list = useQuery({
    queryKey: ["play-ideas", offset],
    queryFn: () => workshopJson<IdeaList>(`play-ideas?offset=${offset}`),
  });
  const detail = useQuery({
    queryKey: ["play-idea", selected],
    queryFn: () => workshopJson<PlayIdea>(`play-ideas/${selected}`),
    enabled: !!selected,
  });
  useEffect(
    () => () => {
      window.speechSynthesis?.cancel();
    },
    [],
  );
  const mutate = async (method: "PATCH" | "DELETE", status?: IdeaStatus) => {
    setBusy(true);
    setMessage("");
    try {
      await workshopJson(`play-ideas/${selected}`, {
        method,
        ...(status
          ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }
          : {}),
      });
      await client.invalidateQueries({ queryKey: ["play-ideas"] });
      if (method === "DELETE") {
        setSelected(null);
        setDeleting(false);
        setMessage("Idea deleted.");
      } else await client.invalidateQueries({ queryKey: ["play-idea", selected] });
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not update idea.");
    } finally {
      setBusy(false);
    }
  };
  const idea = detail.data;
  return (
    <section>
      <p className="eyebrow">PLAYER FEEDBACK</p>
      <h1>Play ideas</h1>
      <p>
        Private ideas sent from the game. Submissions are anonymous; text and game pictures are
        supplied by players.
      </p>
      <button
        type="button"
        onClick={() => void client.invalidateQueries({ queryKey: ["play-ideas"] })}
      >
        Refresh ideas
      </button>
      <p role="status">{message}</p>
      {list.error || detail.error ? (
        <p role="alert">{(list.error ?? detail.error)?.message}</p>
      ) : null}
      {list.isPending ? <p>Loading ideas…</p> : null}
      {list.data?.total === 0 ? <p>No play ideas yet. Choose 💡 Idea in the game menu.</p> : null}
      <ul className="play-idea-list">
        {list.data?.ideas.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => {
                window.speechSynthesis?.cancel();
                setSelected(item.id);
                setDeleting(false);
                setMessage("");
              }}
            >
              <strong>
                {item.status === "new" ? "New" : item.status === "planned" ? "Planned" : "Done"}
              </strong>{" "}
              · {item.text.slice(0, 120)}
              <small> · {new Date(item.createdAt).toLocaleString()}</small>
            </button>
          </li>
        ))}
      </ul>
      <div className="button-row">
        <button
          type="button"
          disabled={offset === 0}
          onClick={() => setOffset(Math.max(0, offset - 30))}
        >
          Previous ideas
        </button>
        <button
          type="button"
          disabled={!list.data || offset + 30 >= list.data.total}
          onClick={() => setOffset(offset + 30)}
        >
          Next ideas
        </button>
      </div>
      {selected && detail.isPending ? <p>Loading game picture…</p> : null}
      {idea ? (
        <article className="play-idea-detail">
          <h2>Idea</h2>
          <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{idea.text}</p>
          <button
            type="button"
            onClick={() => {
              if (!speakIdea(idea.text, idea.language))
                setMessage("Reading aloud is unavailable in this browser.");
            }}
          >
            🔊 Read idea aloud
          </button>
          <p>
            <img
              src={idea.screenshot}
              alt="Game view attached to this idea"
              style={{ maxWidth: "100%", maxHeight: 480, objectFit: "contain" }}
            />
          </p>
          <dl>
            <dt>Received</dt>
            <dd>{new Date(idea.createdAt).toLocaleString()}</dd>
            <dt>World / realm</dt>
            <dd>{idea.context.worldId || "Not selected"}</dd>
            <dt>Position</dt>
            <dd>
              {Math.round(idea.context.x)}, {Math.round(idea.context.y)}
            </dd>
            <dt>Language</dt>
            <dd>{idea.language}</dd>
            <dt>Game build</dt>
            <dd>{idea.context.build}</dd>
            <dt>Picture captured</dt>
            <dd>{idea.context.capturedAt}</dd>
          </dl>
          <details>
            <summary>Generation context</summary>
            <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
              {idea.context.generation}
            </pre>
          </details>
          <label>
            Status{" "}
            <select
              aria-label="Idea status"
              value={idea.status}
              disabled={busy}
              onChange={(e) => void mutate("PATCH", e.target.value as IdeaStatus)}
            >
              <option value="new">New</option>
              <option value="planned">Planned</option>
              <option value="done">Done</option>
            </select>
          </label>{" "}
          {deleting ? (
            <>
              <span>Delete this idea and its picture permanently? </span>
              <button type="button" disabled={busy} onClick={() => void mutate("DELETE")}>
                Delete permanently
              </button>{" "}
              <button type="button" onClick={() => setDeleting(false)}>
                Keep idea
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setDeleting(true)}>
              Delete idea
            </button>
          )}
        </article>
      ) : null}
    </section>
  );
}
