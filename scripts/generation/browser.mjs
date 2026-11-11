import { createServer } from "node:http";
import { chromium } from "playwright-core";
import { openCdpTab } from "../cdp-tab.mjs";

export async function runBrowser({ code, options, endpoint, port }) {
  if (endpoint && (!Number.isInteger(port) || port < 1 || port > 65535))
    throw Error("--cdp requires a dedicated --port=1..65535 reachable from the device");
  const server = createServer((req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", req.url === "/worker.js" ? "text/javascript" : "text/html");
    res.end(
      req.url === "/worker.js"
        ? code
        : "<!doctype html><title>Tilefun generation benchmark</title>",
    );
  });
  let browser, page;
  try {
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(port, "127.0.0.1", resolve);
    });
    if (endpoint) page = await openCdpTab(endpoint);
    else {
      browser = await chromium.launch();
      page = await browser.newPage();
    }
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    const runtime = await page.evaluate(() => ({
      kind: "browser-worker",
      userAgent: navigator.userAgent,
      cores: navigator.hardwareConcurrency,
    }));
    const result = await page.evaluate(
      (options) =>
        new Promise((resolve, reject) => {
          const worker = new Worker("/worker.js", { type: "module" });
          const timer = setTimeout(() => {
            worker.terminate();
            reject(Error("Generation Worker timed out after five minutes"));
          }, 300_000);
          const stop = () => {
            clearTimeout(timer);
            worker.terminate();
          };
          worker.onmessage = ({ data }) => {
            stop();
            if (data.error) reject(Error(data.error));
            else resolve(data.report);
          };
          worker.onerror = (error) => {
            stop();
            reject(Error(error.message));
          };
          worker.postMessage(options);
        }),
      options,
    );
    return { result, runtime };
  } finally {
    await page?.close();
    await browser?.close();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}
