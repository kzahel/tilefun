/** Keep transport switches on this installation; never navigate to an untrusted invitation origin. */
export function sessionUrl(
  mode: "host" | "join" | "local",
  invitation = "",
  current = location.href,
): string {
  const url = new URL(current);
  for (const key of [
    "host",
    "join",
    "server",
    "multiplayer",
    "transport",
    "generation",
    "arrival",
    "worldId",
    "signal",
    "signalPath",
    "playerid",
  ])
    url.searchParams.delete(key);
  if (mode === "host") url.searchParams.set("host", "");
  if (mode === "join") {
    let code = invitation.trim();
    if (code.includes("://")) code = new URL(code).searchParams.get("join") ?? "";
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(code))
      throw Error("Enter a valid join code or Tilefun invitation link.");
    url.searchParams.set("join", code);
  }
  return url.href;
}
export function requestSessionNavigation(url: string): void {
  window.dispatchEvent(new CustomEvent("tilefun-navigate", { detail: url }));
}
