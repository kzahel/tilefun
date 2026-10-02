import { sessionRequest } from "./AuthClient.js";
import { workshopHref } from "./ToolRegistry.js";

const params = new URLSearchParams(location.search),
  embedded = params.get("workshopEmbed") === "1";
if (embedded) {
  const style = document.createElement("style");
  style.textContent =
    'header > .brand, header > h1, header a[href$="tools.html"] { display:none; }';
  document.head.append(style);
} else {
  document.documentElement.style.setProperty("--workshop-nav-height", "40px");
  const bar = document.createElement("nav");
  bar.setAttribute("aria-label", "Workshop");
  bar.style.cssText =
    "position:relative;z-index:1000;display:flex;gap:16px;justify-content:space-between;align-items:center;padding:10px 16px;background:#17372e;color:#f8f5ed;font:14px system-ui";
  const link = document.createElement("a");
  link.href = "/tilefun/workshop.html";
  link.textContent = "Tilefun Workshop · Inbox & all tools";
  link.style.color = "inherit";
  const login = document.createElement("a");
  login.href = "/tilefun/workshop.html#/login";
  login.textContent = "Sign in";
  login.style.color = "inherit";
  bar.append(link, login);
  document.body.prepend(bar);
  const status = () =>
    void sessionRequest()
      .then((s) => {
        login.textContent = s.local
          ? "Local access"
          : s.authenticated
            ? `Signed in · ${s.owner}`
            : "Sign in to save feedback";
      })
      .catch(() => {
        login.textContent = "Login unavailable";
      });
  window.addEventListener("tilefun:sign-in", () => {
    login.textContent = "Sign in to sync pending feedback";
  });
  status();
  // A direct bookmark can enter the same selection in the workspace.
  const current = new URL(location.href);
  const tool = current.pathname.endsWith("art-workbench.html")
    ? "art"
    : current.pathname.endsWith("building-lab.html")
      ? params.get("run") === "surfaces"
        ? "roads"
        : params.get("run") === "districts"
          ? "districts"
          : params.get("run") === "streets"
            ? "streets"
            : "buildings"
      : current.pathname.endsWith("interior-review.html")
        ? "rooms"
        : current.pathname.endsWith("interior-workbench.html")
          ? "indoor"
          : current.pathname.endsWith("furniture-playtest.html")
            ? "motion"
            : current.pathname.endsWith("world-explorer.html")
              ? "explorer"
              : "";
  if (tool) {
    const open = document.createElement("a");
    open.href = workshopHref(tool, current.search);
    open.textContent = "Open this in Workshop →";
    open.style.color = "inherit";
    bar.insertBefore(open, login);
  }
}
