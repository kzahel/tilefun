// One owned tab in an already-running browser, over raw DevTools Protocol.
// Playwright's connectOverCDP attaches to every existing tab first and can hang
// on a phone's discarded background tabs; this touches only the tab it creates.
// The surface mirrors the few Playwright Page calls the device benches use.
import { writeFile } from "node:fs/promises";

/** `existingPage` drives the browser's first page instead of a new tab (a
 * packaged shell has one window); `close` then leaves that page open. */
export async function openCdpTab(endpoint, { existingPage = false } = {}) {
  const base = endpoint.replace(/\/$/, "");
  const json = async (pathname) => {
    const response = await fetch(`${base}${pathname}`);
    if (!response.ok) throw Error(`DevTools ${pathname}: ${response.status}`);
    return response.json();
  };
  const version = await json("/json/version");
  // Android Chrome refuses /json/new; create and attach through the browser socket.
  const socket = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", () => reject(Error("DevTools socket failed")), { once: true });
  });
  let nextId = 1;
  const pending = new Map();
  const listeners = { pageerror: [], load: [] };
  const events = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const waiter = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) waiter?.reject(Error(message.error.message));
      else waiter?.resolve(message.result);
    } else if (message.method === "Runtime.exceptionThrown") {
      const details = message.params.exceptionDetails;
      const error = Error(details.exception?.description ?? details.text);
      for (const listener of listeners.pageerror) listener(error);
    } else if (message.method === "Page.loadEventFired")
      for (const listener of listeners.load.splice(0)) listener();
    // Any other protocol event, by its method name (Worker profiling listens to Target.*).
    else for (const listener of events.get(message.method) ?? []) listener(message.params);
  });
  let sessionId;
  const call = (method, params, session) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      socket.send(
        JSON.stringify({ id, method, params, ...(session ? { sessionId: session } : {}) }),
      );
    });
  let targetId;
  if (existingPage) {
    const { targetInfos } = await call("Target.getTargets");
    targetId = targetInfos.find((t) => t.type === "page")?.targetId;
    if (!targetId) throw Error("The attached browser has no page");
  } else ({ targetId } = await call("Target.createTarget", { url: "about:blank" }));
  ({ sessionId } = await call("Target.attachToTarget", { targetId, flatten: true }));
  const send = (method, params = {}) => call(method, params, sessionId);
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Page.bringToFront");
  const evaluate = async (fn, arg) => {
    const expression =
      typeof fn === "string" ? fn : `(${fn})(${arg === undefined ? "" : JSON.stringify(arg)})`;
    const result = await send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails)
      throw Error(
        result.exceptionDetails.exception?.description ??
          result.exceptionDetails.text ??
          "evaluate",
      );
    return result.result.value;
  };
  const waitForTimeout = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  return {
    browserVersion: version.Browser,
    on(name, listener) {
      if (listeners[name]) listeners[name].push(listener);
      else events.set(name, [...(events.get(name) ?? []), listener]);
    },
    evaluate,
    waitForTimeout,
    send,
    async goto(url) {
      const loaded = new Promise((resolve) => listeners.load.push(resolve));
      await send("Page.navigate", { url });
      await Promise.race([loaded, waitForTimeout(120_000)]);
    },
    async waitForFunction(fn, arg, { timeout = 30_000, polling = 100 } = {}) {
      const end = Date.now() + timeout;
      for (;;) {
        // A navigation can replace the context mid-poll; keep polling.
        if (await evaluate(fn, arg).catch(() => false)) return;
        if (Date.now() > end) throw Error("waitForFunction timed out");
        await waitForTimeout(polling);
      }
    },
    async screenshot({ path }) {
      const { data } = await send("Page.captureScreenshot", { format: "png" });
      await writeFile(path, Buffer.from(data, "base64"));
    },
    async close() {
      if (!existingPage) await call("Target.closeTarget", { targetId }).catch(() => {});
      socket.close();
    },
  };
}
