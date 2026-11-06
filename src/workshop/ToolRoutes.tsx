import { lazy, useEffect, useMemo, useRef } from "react";
import { Link, Navigate, useLocation, useNavigate, useParams } from "react-router";
import { primaryScene, reviewUnits, scenePath } from "./SceneReview.js";
import { TOOL_PAGES } from "./ToolPages.js";
import { reviewToolOwnsBatch, WORKSHOP_TOOLS } from "./ToolRegistry.js";
import {
  AuthGate,
  candidateLabel,
  ErrorMessage,
  legacyDestination,
  reviewPath,
} from "./WorkshopCommon.js";
import { useInbox, useManifest } from "./WorkshopQueries.js";

const SourcePage = lazy(() => import("./SourcePage.js"));

export function ToolsPage() {
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">ALL TOOLS / ONE WORKSPACE</p>
          <h1>Find your tool.</h1>
          <p>Browse source art, review compositions, edit fixtures or explore generated worlds.</p>
        </div>
      </div>
      <div className="tool-grid">
        {WORKSHOP_TOOLS.map((tool) => (
          <article className="tool-card" key={tool.id}>
            <span className="tag">
              {tool.mode === "source"
                ? "Annotate"
                : tool.mode === "review"
                  ? "Review"
                  : tool.mode === "link"
                    ? "Game catalogue"
                    : "Edit / explore"}
            </span>
            <h2>{tool.name}</h2>
            <p>{tool.description}</p>
            {tool.mode === "link" ? (
              <a className="button" href={`/tilefun/${tool.url}`}>
                Open in game ↗
              </a>
            ) : (
              <Link className="button" to={`/tool/${tool.id}`}>
                Open tool →
              </Link>
            )}
          </article>
        ))}
      </div>
    </>
  );
}
/** `/tool/:tool`: dedicated page, source annotator, review list, catalogue link or iframe adapter. */
export function ToolPage() {
  const { tool: toolId = "" } = useParams(),
    tool = WORKSHOP_TOOLS.find((t) => t.id === toolId),
    location = useLocation();
  if (!tool) return <Navigate to="/tools" replace />;
  const page = TOOL_PAGES[tool.id];
  if (page) return page;
  if (tool.mode === "source") return <SourcePage />;
  if (tool.mode === "review")
    return (
      <AuthGate>
        <ReviewTool toolId={tool.id} query={location.search} />
      </AuthGate>
    );
  if (tool.mode === "link")
    return (
      <section className="empty">
        <h1>{tool.name}</h1>
        <a className="button" href={`/tilefun/${tool.url}`}>
          Open game catalogue ↗
        </a>
      </section>
    );
  return <ToolAdapter toolId={tool.id} query={location.search} />;
}
function ReviewTool({ toolId, query }: { toolId: string; query: string }) {
  const inbox = useInbox(),
    manifest = useManifest(),
    navigate = useNavigate();
  const batches = manifest.data?.batches;
  // Stable between query refreshes so URL redirection does not run on every render.
  const candidates = useMemo(
    () =>
      (inbox.data ? reviewUnits(inbox.data.candidates) : undefined)?.filter((c) =>
        reviewToolOwnsBatch(toolId, c.batchId, batches),
      ) ?? [],
    [inbox.data, batches, toolId],
  );
  useEffect(() => {
    const p = new URLSearchParams(query);
    const target = candidates.find(
      (c) =>
        p.get("case") === c.review?.caseId ||
        p.get("case") === c.id ||
        (p.get("prefab") === c.review?.prefabIds[0] &&
          c.review?.scene === (p.get("scene") ?? "single")) ||
        (p.get("scene") && c.review?.scene === p.get("scene") && p.get("scene") !== "single"),
    );
    if (target)
      void navigate(
        primaryScene(target) ? scenePath(target) : reviewPath(target.id) + "?show=all",
        {
          replace: true,
        },
      );
  }, [query, candidates, navigate]);
  if (!inbox.data || !manifest.data) return <ErrorMessage error={inbox.error ?? manifest.error} />;
  const tool = WORKSHOP_TOOLS.find((t) => t.id === toolId);
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">REVIEW TOOL</p>
          <h1>{tool?.name}</h1>
          <p>{tool?.description}</p>
        </div>
      </div>
      {manifest.data.batches
        .filter((b) => b.toolId === toolId)
        .map((b) => (
          <section className="review-batch-list" key={b.id}>
            <h2>{b.name}</h2>
            <div className="case-list">
              {candidates
                .filter((c) => c.batchId === b.id)
                .map((c) => (
                  <Link key={c.id} to={scenePath(c) + (primaryScene(c) ? "" : "?show=all")}>
                    <span>{c.name}</span>
                    <span className={`state ${c.state}`}>{candidateLabel(c)}</span>
                  </Link>
                ))}
            </div>
          </section>
        ))}
    </>
  );
}
function ToolAdapter({ toolId, query }: { toolId: string; query: string }) {
  const tool = WORKSHOP_TOOLS.find((t) => t.id === toolId),
    navigate = useNavigate(),
    manifest = useManifest(),
    frame = useRef<HTMLIFrameElement>(null);
  if (!tool) return null;
  const url = new URL(tool.url, `${location.origin}/tilefun/`);
  new URLSearchParams(query).forEach((v, k) => {
    if (k !== "workshopEmbed") url.searchParams.set(k, v);
  });
  url.searchParams.set("workshopEmbed", "1");
  const loaded = () => {
    const document = frame.current?.contentDocument;
    if (!document) return;
    frame.current?.contentWindow?.addEventListener("tilefun:sign-in", () =>
      window.dispatchEvent(new Event("tilefun:sign-in")),
    );
    document.addEventListener("click", (event) => {
      const a = (event.target as HTMLElement).closest<HTMLAnchorElement>("a[href]");
      if (!a || a.hasAttribute("download") || event.ctrlKey || event.metaKey || event.shiftKey)
        return;
      const destination = legacyDestination(a.href, manifest.data);
      if (destination) {
        event.preventDefault();
        void navigate(destination);
      } else if (a.href.startsWith(location.origin + "/tilefun/")) {
        event.preventDefault();
        location.assign(a.href);
      }
    });
  };
  return (
    <section className="adapter-page">
      <div className="adapter-heading">
        <div>
          <h1>{tool.name}</h1>
          <p>{tool.description}</p>
        </div>
        <a
          href={url.pathname + url.search.replace(/[?&]workshopEmbed=1/, "")}
          target="_blank"
          rel="noreferrer"
        >
          Open full window ↗
        </a>
      </div>
      {tool.id === "explorer" || tool.id === "indoor" ? (
        <p className="notice compact">
          {tool.id === "explorer"
            ? "Explorer judgments stay in this browser; shared city reviews are in the inbox."
            : "Editable fixtures stay in this browser. Use the editor’s Export / Import to transfer them."}
        </p>
      ) : null}
      <iframe ref={frame} title={tool.name} src={url.pathname + url.search} onLoad={loaded} />
    </section>
  );
}
