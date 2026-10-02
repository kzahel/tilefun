import type { WorkshopSession } from "./WorkshopTypes.js";

export class SignInRequired extends Error {
  constructor() {
    super("Sign in to the Workshop to sync. Unsent feedback is retained.");
  }
}
export async function sessionRequest(): Promise<WorkshopSession> {
  const response = await fetch("/tilefun/api/auth/session", { cache: "no-store" });
  if (!response.ok) throw new Error("Login status unavailable");
  return response.json();
}
/** The cookie never enters JS. Get the session CSRF token for each mutation so
 * reset/login in another tab cannot leave a stale cached credential behind.
 */
export async function workshopFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const mutation = !["GET", "HEAD"].includes(init.method ?? "GET");
  if (mutation) {
    const session = await sessionRequest();
    if (!session.authenticated) {
      if (typeof window !== "undefined") window.dispatchEvent(new Event("tilefun:sign-in"));
      throw new SignInRequired();
    }
    const headers = new Headers(init.headers);
    headers.set("X-Workshop-CSRF", session.csrfToken ?? "");
    init = { ...init, headers };
  }
  const response = await fetch(url, { ...init, credentials: "same-origin" });
  if (response.status === 401) {
    if (typeof window !== "undefined") window.dispatchEvent(new Event("tilefun:sign-in"));
    throw new SignInRequired();
  }
  return response;
}
export async function workshopJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await workshopFetch(`/tilefun/api/${path}`, init);
  if (!response.ok) {
    const data = await response.json().catch(() => ({ error: "Request failed" }));
    throw new Error(data.error ?? `Server returned ${response.status}`);
  }
  return response.json();
}
