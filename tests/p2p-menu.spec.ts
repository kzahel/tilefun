import type { Server } from "node:http";
import { expect, test } from "@playwright/test";

test.use({ channel: "chromium" });

import { PeerServer } from "peer";

// Real local signaling + real browser WebRTC. No cloud availability or fake gameplay transport.
test("host and join through menus share a world and can return to local play", async ({
  browser,
}) => {
  test.setTimeout(90_000);
  let broker!: Server;
  PeerServer({ port: 0, host: "127.0.0.1", path: "/peerjs" }, (server) => {
    broker = server;
  });
  await expect.poll(() => !!broker?.listening).toBe(true);
  const address = broker.address();
  if (!address || typeof address === "string") throw Error("Missing signaling port");
  const peerServer = encodeURIComponent(`http://127.0.0.1:${address.port}/peerjs`);
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  try {
    const host = await hostContext.newPage(),
      guest = await guestContext.newPage();
    const generation = encodeURIComponent(
      JSON.stringify({ type: "flat", version: "flat-v1", seed: 42, preset: "grass" }),
    );
    await host.goto(`/tilefun/?desktop=1&peerServer=${peerServer}&generation=${generation}`);
    await host.getByRole("button", { name: "New World", exact: true }).click();
    await expect(host.getByTestId("world-menu")).toBeHidden();
    await host.keyboard.press("Escape");
    await host.getByRole("button", { name: "Multiplayer", exact: true }).click();
    await host.getByRole("button", { name: "Host P2P", exact: true }).click();
    await expect(host.getByText("Hosting as Player 1", { exact: true })).toBeVisible({
      timeout: 30_000,
    });
    const code = (await host.getByText(/^Join code:/).textContent())?.replace("Join code: ", "");
    if (!code) throw Error("No host code");
    await host.getByRole("button", { name: "Back", exact: true }).click();
    await host.getByRole("button", { name: "Resume", exact: true }).click();
    await guest.goto(`/tilefun/?desktop=1&peerServer=${peerServer}&generation=${generation}`);
    await guest.getByRole("button", { name: "New World", exact: true }).click();
    await expect(guest.getByTestId("world-menu")).toBeHidden();
    if (!(await guest.getByTestId("world-menu").isVisible())) await guest.keyboard.press("Escape");
    await expect(guest.getByTestId("world-menu")).toBeVisible();
    await guest.getByRole("button", { name: "Multiplayer", exact: true }).click();
    await guest.getByRole("button", { name: "Join with code or link" }).click();
    await guest.getByLabel("Join code or link", { exact: true }).fill(code);
    await guest.getByRole("button", { name: "Join game", exact: true }).click();
    await guest.waitForURL(/join=/, { waitUntil: "load" });
    await expect(guest.locator("#game")).toHaveAttribute("data-ready", "true", { timeout: 30_000 });
    const players = (page: typeof host) =>
      page.evaluate(() => {
        const game = (
          document.querySelector("#game") as unknown as {
            __game: { stateView: { entities: { type: string }[] } };
          }
        ).__game;
        return game.stateView.entities.filter((e) => e.type === "player").length;
      });
    await expect.poll(() => players(host)).toBe(2);
    await expect.poll(() => players(guest)).toBe(2);
    await expect(host.locator("#game")).toHaveAttribute("data-renderer", "gpu");
    await expect(guest.locator("#game")).toHaveAttribute("data-renderer", "gpu");
    await expect(guest.getByTestId("world-menu")).toBeVisible({ timeout: 30000 });
    await guest.getByRole("button", { name: "Multiplayer", exact: true }).click();
    await Promise.all([
      guest.waitForURL((url) => !url.searchParams.has("join"), { waitUntil: "load" }),
      guest.getByRole("button", { name: "Leave multiplayer" }).click({ timeout: 5000 }),
    ]);
    // A changed URL precedes startup of the replacement local authority/client.
    // The desktop boot menu is the actual UI completion of that initialization.
    await guest.getByTestId("world-menu").waitFor({ state: "visible" });
    await expect(guest).not.toHaveURL(/join=/);
    await expect(guest.locator("#game")).toHaveAttribute("data-ready", "true");
  } finally {
    await Promise.all([hostContext.close(), guestContext.close()]);
    broker.close();
    broker.closeAllConnections();
  }
});
