/** A URL fragment is not sent in HTTP requests. Keep credentials out of saved links and history. */
export function takeAdminToken(url: URL): { token: string | undefined; url: URL } {
  const fragment = new URLSearchParams(url.hash.slice(1));
  const token = fragment.get("adminToken") ?? undefined;
  if (token !== undefined) {
    fragment.delete("adminToken");
    url.hash = fragment.toString();
  }
  return { token, url };
}
