import { expect, test } from "@playwright/test";
import type { RemoteStateView } from "../src/client/ClientStateView.js";
import type { IClientTransport } from "../src/transport/Transport.js";
import type { WorkerClientTransport } from "../src/transport/WorkerClientTransport.js";
import { advancing, session, state } from "./helpers/p2pSession.js";

test.use({ channel: "chromium" });
type ClientCanvas = HTMLCanvasElement & {
  __game: { transport: IClientTransport; stateView: RemoteStateView };
};
type HostCanvas = HTMLCanvasElement & {
  __game: {
    netEmulatedTransport: { base: WorkerClientTransport };
    stateView: RemoteStateView;
    remoteView: RemoteStateView;
    loop: { stop(): void; start(): void };
  };
};

test("P2P Worker isolates authority and rendering, serves a hidden host, and saves on Stop hosting", async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const { host, guest, dispose } = await session(browser, false);
  const errors: string[] = [];
  for (const page of [host, guest]) page.on("pageerror", (error) => errors.push(error.message));
  try {
    const worker = host.workers().find((item) => item.url().includes("local-server.worker"));
    if (!worker) throw Error("P2P host did not start Worker authority");
    const debug = await host.evaluate(() =>
      (
        document.querySelector("#game") as HostCanvas
      ).__game.netEmulatedTransport.base.getDebugInfo(),
    );
    expect(debug.transport).toContain("Worker");

    // Read the existing out-of-band diagnostic protocol in the Worker itself.
    // This samples actual completed ticks while the main thread cannot respond.
    const authoritySamples = worker.evaluate(async () => {
      const scope = globalThis as unknown as {
        postMessage(message: unknown, transfer?: Transferable[]): void;
        dispatchEvent(event: Event): boolean;
      };
      const post = scope.postMessage;
      let ticks = 0;
      scope.postMessage = (message, transfer) => {
        const reply = message as { kind: string; id: number; diagnostics: { ticks: number } };
        if (reply.kind === "heartbeat" && reply.id === -1) ticks = reply.diagnostics.ticks;
        else post.call(scope, message, transfer);
      };
      const samples: { at: number; ticks: number }[] = [];
      try {
        const until = Date.now() + 800;
        while (Date.now() < until) {
          scope.dispatchEvent(new MessageEvent("message", { data: { kind: "probe", id: -1 } }));
          samples.push({ at: Date.now(), ticks });
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
        return samples;
      } finally {
        scope.postMessage = post;
      }
    });
    const mainStall = await host.evaluate(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      const start = Date.now();
      while (Date.now() - start < 350) {
        /* controlled main-thread stall */
      }
      return { start, end: Date.now() };
    });
    const duringMainStall = (await authoritySamples).filter(
      (sample) => sample.at > mainStall.start + 20 && sample.at < mainStall.end - 20,
    );
    expect(duringMainStall.length).toBeGreaterThan(5);
    const first = duringMainStall[0],
      last = duringMainStall.at(-1);
    if (!first || !last) throw Error("Missing authority samples during main-thread stall");
    expect(last.ticks - first.ticks).toBeGreaterThan(8);

    const renderSamples = host.evaluate(async () => {
      const times: number[] = [],
        until = Date.now() + 700;
      while (Date.now() < until) {
        await new Promise(requestAnimationFrame);
        times.push(Date.now());
      }
      return times;
    });
    const authorityStall = await worker.evaluate(() => {
      const start = Date.now();
      while (Date.now() - start < 350) {
        /* controlled authority-thread stall */
      }
      return { start, end: Date.now() };
    });
    const renderedDuringStall = (await renderSamples).filter(
      (time) => time > authorityStall.start && time < authorityStall.end,
    );
    expect(renderedDuringStall.length).toBeGreaterThan(4);

    // Deterministic visibility delivery plus a stopped render loop models the
    // host's dormant local client; it does not claim OS background-timer parity.
    const hidden = await host.evaluate(async () => {
      const game = (document.querySelector("#game") as HostCanvas).__game;
      game.loop.stop();
      Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => "hidden",
      });
      document.dispatchEvent(new Event("visibilitychange"));
      return game.netEmulatedTransport.base.getDiagnostics();
    });
    expect(hidden.authority?.hidden).toBe(true);
    const guestTick = (await state(guest)).tick;
    await expect.poll(async () => (await state(guest)).tick).toBeGreaterThan(guestTick + 120);
    const background = await host.evaluate(async () => {
      const game = (document.querySelector("#game") as HostCanvas).__game;
      return {
        diagnostics: await game.netEmulatedTransport.base.getDiagnostics(),
        pending: game.remoteView.pendingMessageCount,
      };
    });
    const initialAuthority = hidden.authority,
      backgroundAuthority = background.diagnostics.authority;
    if (!initialAuthority || !backgroundAuthority) throw Error("Missing host diagnostics");
    expect(backgroundAuthority.ticks).toBeGreaterThan(initialAuthority.ticks + 100);
    expect(background.pending).toBeLessThan(64);
    expect(backgroundAuthority.channel.highWaterBytes).toBeLessThan(16 * 1024 * 1024);
    expect(backgroundAuthority.peers).toHaveLength(1);
    await test.info().attach("worker-independence", {
      contentType: "application/json",
      body: JSON.stringify(
        {
          ticksDuringMainStall: last.ticks - first.ticks,
          framesDuringAuthorityStall: renderedDuringStall.length,
          backgroundTicks: backgroundAuthority.ticks - initialAuthority.ticks,
          localPending: background.pending,
          authority: backgroundAuthority,
        },
        null,
        2,
      ),
    });
    // Exercise guest -> Worker command admission while host rendering is stopped.
    await guest.evaluate(() => {
      const transport = (document.querySelector("#game") as ClientCanvas).__game.transport;
      transport.send({ type: "set-editor-mode", enabled: true });
      transport.send({ type: "edit-elevation", tx: 0, ty: 0, height: 2, gridSize: 1 });
    });
    await expect
      .poll(() =>
        guest.evaluate(() =>
          (document.querySelector("#game") as ClientCanvas).__game.stateView.world.getHeightAt(
            0,
            0,
          ),
        ),
      )
      .toBe(2);
    await host.evaluate(() => {
      Reflect.deleteProperty(document, "hidden");
      Reflect.deleteProperty(document, "visibilityState");
      document.dispatchEvent(new Event("visibilitychange"));
      (document.querySelector("#game") as HostCanvas).__game.loop.start();
    });
    await advancing(host);
    const height = () =>
      host.evaluate(() =>
        (document.querySelector("#game") as HostCanvas).__game.stateView.world.getHeightAt(0, 0),
      );
    await expect.poll(height).toBe(2);
    await host.keyboard.press("Escape");
    await host.getByRole("button", { name: "Multiplayer", exact: true }).click();
    await Promise.all([
      host.waitForURL((url) => !url.searchParams.has("host")),
      host.getByRole("button", { name: "Stop hosting", exact: true }).click(),
    ]);
    await expect(host.locator("#game")).toHaveAttribute("data-ready", "true");
    await host.getByRole("button", { name: "Resume", exact: true }).click();
    await expect.poll(height).toBe(2);
    expect(errors).toEqual([]);
  } finally {
    await dispose();
  }
});
