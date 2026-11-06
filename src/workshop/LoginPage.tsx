import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { ErrorMessage } from "./WorkshopCommon.js";
import { useSession } from "./WorkshopQueries.js";
import type { WorkshopSession } from "./WorkshopTypes.js";

export function LoginPage() {
  const session = useSession(),
    navigate = useNavigate(),
    location = useLocation(),
    queryClient = useQueryClient();
  const [username, setUsername] = useState("owner"),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const rawReturn = new URLSearchParams(location.search).get("returnTo") ?? "/",
    returnTo = rawReturn.startsWith("/") && !rawReturn.startsWith("//") ? rawReturn : "/";
  if (session.data?.authenticated)
    return (
      <section className="empty">
        <h1>You’re signed in.</h1>
        <Link className="button" to={returnTo}>
          Return to Workshop
        </Link>
      </section>
    );
  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/tilefun/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error ?? "Login failed");
      queryClient.setQueryData<WorkshopSession>(["session"], value);
      setPassword("");
      void navigate(returnTo, { replace: true });
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="login-card">
      <p className="eyebrow">TILEFUN WORKSHOP</p>
      <h1>Your art desk, together.</h1>
      <p>Sign in to see review progress, annotate source art and share feedback.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <label>
          Username
          <input
            aria-label="Username"
            name="username"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </label>
        <label>
          Password
          <input
            aria-label="Password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button
          type="submit"
          className="primary"
          disabled={busy || session.data?.configured === false}
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <ErrorMessage error={error} />
      {session.data?.configured === false ? (
        <p className="notice">
          Owner login hasn’t been configured on this server. Run{" "}
          <code>npm run workshop:auth -- setup</code> there.
        </p>
      ) : null}
      <Link to="/tools">Browse public tools →</Link>
    </section>
  );
}
