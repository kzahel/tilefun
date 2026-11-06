import type { ReactNode } from "react";
import { Link, useLocation } from "react-router";
import { isCityReviewRun } from "../art/CityReviewRuns.js";
import { primaryScene, scenePath } from "./SceneReview.js";
import { WORKSHOP_TOOLS } from "./ToolRegistry.js";
import { useManifest, useSession } from "./WorkshopQueries.js";
import type { CandidateSummary, WorkshopManifest } from "./WorkshopTypes.js";

export const reviewPath = (id: string) => `/review/${encodeURIComponent(id)}`;
export const threadPath = (id: string) => `/thread/${encodeURIComponent(id)}`;
export function candidateLabel(c: CandidateSummary) {
  return c.state === "changes"
    ? "Needs changes"
    : c.state === "changed"
      ? "Changed · review again"
      : c.state === "approved"
        ? "Approved"
        : c.state === "excluded"
          ? "Compiler exclusion"
          : "Unchecked";
}
export function ErrorMessage({ error }: { error: unknown }) {
  return error ? (
    <p className="notice error" role="alert">
      {error instanceof Error ? error.message : String(error)}
    </p>
  ) : null;
}
export function legacyDestination(url: string, manifest?: WorkshopManifest) {
  const parsed = new URL(url, `${location.origin}/tilefun/`);
  if (parsed.origin !== location.origin || !parsed.pathname.startsWith("/tilefun/")) return null;
  if (parsed.pathname.endsWith("workshop.html") && parsed.hash.startsWith("#/"))
    return parsed.hash.slice(1);
  const candidate = manifest?.candidates.find(
    (c) =>
      new URL(c.url, location.origin).pathname === parsed.pathname &&
      (parsed.searchParams.get("case") === c.review?.caseId ||
        parsed.searchParams.get("case") === c.id ||
        (c.review?.scene === "single" &&
          parsed.searchParams.get("prefab") === c.review.prefabIds[0]) ||
        (["mixed", "residential", "hotel"].includes(c.review?.scene ?? "") &&
          parsed.searchParams.get("scene") === c.review?.scene)),
  );
  if (candidate)
    return primaryScene(candidate) ? scenePath(candidate) : reviewPath(candidate.id) + "?show=all";
  const tool = parsed.pathname.endsWith("building-lab.html")
    ? WORKSHOP_TOOLS.find(
        (t) =>
          t.id ===
          (["surfaces", "road-geometry"].includes(parsed.searchParams.get("run") ?? "")
            ? "roads"
            : ["districts", "commercial"].includes(parsed.searchParams.get("run") ?? "") ||
                isCityReviewRun(parsed.searchParams.get("run") ?? "")
              ? "districts"
              : parsed.searchParams.get("run") === "streets"
                ? "streets"
                : "buildings"),
      )
    : WORKSHOP_TOOLS.find(
        (t) => new URL(t.url, `${location.origin}/tilefun/`).pathname === parsed.pathname,
      );
  if (parsed.pathname.endsWith("tools.html")) return "/tools";
  return tool && tool.mode !== "link" ? `/tool/${tool.id}${parsed.search}` : null;
}
export function LegacyLink({
  url,
  children,
  className,
}: {
  url: string;
  children: ReactNode;
  className?: string;
}) {
  const manifest = useManifest(),
    destination = legacyDestination(url, manifest.data);
  return destination ? (
    <Link className={className} to={destination}>
      {children}
    </Link>
  ) : (
    <a className={className} href={url}>
      {children}
    </a>
  );
}
export function AuthGate({ children }: { children: ReactNode }) {
  const session = useSession(),
    location = useLocation();
  if (session.isPending) return <p role="status">Checking login…</p>;
  if (session.error) return <ErrorMessage error={session.error} />;
  if (!session.data?.authenticated)
    return (
      <section className="empty">
        <p className="eyebrow">PRIVATE WORKSPACE</p>
        <h1>Sign in to your Workshop.</h1>
        <p>
          Your reviews and notes are shared across tools. Drafts and pending saves stay in this
          browser.
        </p>
        <Link
          className="button"
          to={`/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`}
        >
          Sign in
        </Link>
      </section>
    );
  return children;
}
