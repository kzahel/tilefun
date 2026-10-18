import { readFile, writeFile } from "node:fs/promises";

// Dependency-free, bounded acceptance interface; run with the packaged Electron's Node mode.
const endpoint = process.env.TILEFUN_CDP_ENDPOINT ?? "http://127.0.0.1:9223";
const pages = await (await fetch(`${endpoint}/json/list`)).json();
const page = pages.find((p) => p.type === "page" && p.url.startsWith("tilefun://app/"));
if (!page) throw Error("No packaged Tilefun page");
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.onopen = resolve;
  socket.onerror = reject;
});
let sequence = 0;
const pending = new Map();
socket.onmessage = ({ data }) => {
  const message = JSON.parse(data);
  const waiter = pending.get(message.id);
  if (!waiter) return;
  pending.delete(message.id);
  clearTimeout(waiter.timer);
  message.error
    ? waiter.reject(Error(JSON.stringify(message.error)))
    : waiter.resolve(message.result);
};
function call(method, params = {}) {
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(Error(`CDP timeout: ${method}`));
    }, 30_000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
try {
  if (process.argv[2] === "call") {
    console.log(JSON.stringify(await call(process.argv[3], JSON.parse(process.argv[4] ?? "{}"))));
  } else if (process.argv[2] === "capture") {
    const result = await call("Page.captureScreenshot", { format: "png" });
    await writeFile(process.argv[3] ?? "/tmp/tilefun-deck.png", Buffer.from(result.data, "base64"));
  } else {
    const expression =
      process.argv[2] === "file"
        ? await readFile(process.argv[3], "utf8")
        : (process.argv[2] ??
          `JSON.stringify({url:location.href, ready:document.querySelector('#game')?.dataset, error:document.querySelector('#tilefun-error-overlay')?.textContent, gamepads:[...navigator.getGamepads()].filter(Boolean).map(p=>({id:p.id,mapping:p.mapping,buttons:p.buttons.length,axes:p.axes.length})), menu:document.querySelector('[data-testid=world-menu]')?.dataset.page})`);
    const result = await call("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails));
    console.log(
      typeof result.result.value === "string"
        ? result.result.value
        : JSON.stringify(result.result.value),
    );
  }
} finally {
  socket.close();
}
