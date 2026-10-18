const { app, BrowserWindow, ipcMain, net, protocol, session, shell } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { pathToFileURL } = require("node:url");

// A stable secure origin preserves IndexedDB through upgrades, install paths and host/join reloads.
protocol.registerSchemesAsPrivileged([
  {
    scheme: "tilefun",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);
if (process.env.TILEFUN_USER_DATA)
  app.setPath("userData", path.resolve(process.env.TILEFUN_USER_DATA));
if (process.env.TILEFUN_CDP_PORT) {
  app.commandLine.appendSwitch("remote-debugging-address", "127.0.0.1");
  app.commandLine.appendSwitch("remote-debugging-port", process.env.TILEFUN_CDP_PORT);
}
app.setName("Tilefun");
const dataRoot = app.getPath("userData");
fs.mkdirSync(dataRoot, { recursive: true });
app.setAppLogsPath(path.join(dataRoot, "logs"));
let window;
let closing = false;
let preparing = false;
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", () => {
    if (window) {
      if (window.isMinimized()) window.restore();
      window.focus();
    }
  });
  app.whenReady().then(async () => {
    const www = path.join(__dirname, "www");
    protocol.handle("tilefun", (request) => {
      const url = new URL(request.url);
      if (url.host !== "app" || !url.pathname.startsWith("/tilefun/"))
        return new Response("Not found", { status: 404 });
      // Optional online feedback uses the same first-party service as the web game.
      if (url.pathname.startsWith("/tilefun/api/")) {
        return net.fetch(
          new Request(`https://tilefun.graehlarts.com${url.pathname}${url.search}`, request),
        );
      }
      let relative;
      try {
        relative = decodeURIComponent(url.pathname.slice("/tilefun/".length)) || "index.html";
      } catch {
        return new Response("Bad path", { status: 400 });
      }
      const file = path.resolve(www, relative);
      if (!file.startsWith(`${www}${path.sep}`)) return new Response("Not found", { status: 404 });
      return net.fetch(pathToFileURL(file).href);
    });
    session.defaultSession.setPermissionRequestHandler((_contents, permission, callback) =>
      callback(permission === "media" || permission === "clipboard-sanitized-write"),
    );
    session.defaultSession.setPermissionCheckHandler(
      (_contents, permission, origin) =>
        origin.startsWith("tilefun://app") &&
        ["media", "clipboard-sanitized-write"].includes(permission),
    );
    window = new BrowserWindow({
      title: "Tilefun",
      width: 1280,
      height: 800,
      backgroundColor: "#15252e",
      fullscreen: process.argv.includes("--fullscreen"),
      autoHideMenuBar: true,
      webPreferences: {
        preload: path.join(__dirname, "preload.cjs"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    const external = (url) => {
      if (/^https?:\/\//.test(url)) void shell.openExternal(url);
    };
    window.webContents.setWindowOpenHandler(({ url }) => {
      external(url);
      return { action: "deny" };
    });
    window.webContents.on("will-navigate", (event, url) => {
      if (!url.startsWith("tilefun://app/tilefun/")) {
        event.preventDefault();
        external(url);
      }
    });
    window.on("close", (event) => {
      if (closing) return;
      event.preventDefault();
      if (!preparing) {
        preparing = true;
        window.webContents.send("tilefun-prepare-quit");
      }
    });
    ipcMain.on("tilefun-quit", (event) => {
      if (event.sender === window.webContents) window.close();
    });
    ipcMain.on("tilefun-finish-quit", (event, error) => {
      if (event.sender !== window.webContents || !preparing) return;
      preparing = false;
      // The renderer presents the controller-accessible save recovery dialog.
      if (error) return;
      closing = true;
      window.close();
    });
    window.webContents.on("render-process-gone", (_event, details) => {
      fs.writeFileSync(path.join(dataRoot, "logs", "renderer-exit.json"), JSON.stringify(details));
      closing = true;
      app.quit();
    });
    window.webContents.on("did-finish-load", () => {
      fs.writeFileSync(
        path.join(dataRoot, "logs", "runtime.json"),
        JSON.stringify({ versions: process.versions, gpu: app.getGPUFeatureStatus() }, null, 2),
      );
    });
    await window.loadURL("tilefun://app/tilefun/?desktop=1");
  });
  app.on("window-all-closed", () => app.quit());
  app.on("before-quit", (event) => {
    if (window && !window.isDestroyed() && !closing) {
      event.preventDefault();
      window.close();
    }
  });
}
