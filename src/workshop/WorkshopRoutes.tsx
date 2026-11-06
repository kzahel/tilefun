import { Component, lazy, type ReactNode, Suspense } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router";
import { InboxPage } from "./InboxPage.js";
import { LoginPage } from "./LoginPage.js";
import { ActivityPage, RequestsPage, ThreadPage } from "./RequestPages.js";
import { ToolPage, ToolsPage } from "./ToolRoutes.js";
import { AuthGate } from "./WorkshopCommon.js";

const FaultReportsPage = lazy(() => import("./FaultReportsPage.js"));
const PlayIdeasPage = lazy(() => import("./PlayIdeasPage.js"));
const ReviewPage = lazy(() => import("./ReviewPage.js"));
const ScenePage = lazy(() => import("./ScenePage.js"));
class WorkspaceBoundary extends Component<{ children: ReactNode }, { error: string }> {
  override state = { error: "" };
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  override render() {
    return this.state.error ? (
      <section className="empty">
        <h1>This view could not load.</h1>
        <p>{this.state.error}</p>
        <button type="button" onClick={() => location.reload()}>
          Reload Workshop
        </button>
      </section>
    ) : (
      this.props.children
    );
  }
}

/** Workshop route table; each top-level section gets a fresh error boundary. */
export function WorkshopRoutes() {
  const route = useLocation();
  return (
    <WorkspaceBoundary key={route.pathname.split("/")[1]}>
      <Suspense fallback={<p role="status">Loading tool…</p>}>
        <Routes>
          <Route
            path="/"
            element={
              <AuthGate>
                <InboxPage />
              </AuthGate>
            }
          />
          <Route
            path="/play-ideas"
            element={
              <AuthGate>
                <PlayIdeasPage />
              </AuthGate>
            }
          />
          <Route
            path="/diagnostics"
            element={
              <AuthGate>
                <FaultReportsPage />
              </AuthGate>
            }
          />
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/requests"
            element={
              <AuthGate>
                <RequestsPage />
              </AuthGate>
            }
          />
          <Route
            path="/activity"
            element={
              <AuthGate>
                <ActivityPage />
              </AuthGate>
            }
          />
          <Route
            path="/thread/:id"
            element={
              <AuthGate>
                <ThreadPage />
              </AuthGate>
            }
          />
          <Route path="/tools" element={<ToolsPage />} />
          <Route path="/tool/:tool" element={<ToolPage />} />
          <Route
            path="/scene/:id"
            element={
              <AuthGate>
                <ScenePage />
              </AuthGate>
            }
          />
          <Route
            path="/review/:id"
            element={
              <AuthGate>
                <ReviewPage />
              </AuthGate>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </WorkspaceBoundary>
  );
}
