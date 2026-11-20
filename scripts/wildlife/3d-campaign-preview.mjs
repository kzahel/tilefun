import { createReadStream } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { ENTITY_DEFS } from "../../src/entities/EntityDefs.ts";

const SAFE_TYPE = /^[a-z0-9-]+$/;
const MODEL_ROUTE = "/assets/models/wildlife3d-review/";
const TYPES = {
  ".glb": "model/gltf-binary",
  ".blend": "application/octet-stream",
  ".png": "image/png",
  ".mp4": "video/mp4",
  ".html": "text/html; charset=utf-8",
};
const suffix = (path) => path.slice(path.lastIndexOf("."));

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return undefined;
  }
}

export async function campaignPreview(directory = "data/wildlife-3d-campaign", selected) {
  const base = resolve(directory);
  const registry = new Map();
  const files = new Map();
  for (const entry of await readdir(base, { withFileTypes: true })) {
    if (
      !entry.isDirectory() ||
      !SAFE_TYPE.test(entry.name) ||
      (selected && !selected.has(entry.name))
    )
      continue;
    const type = entry.name;
    const def = ENTITY_DEFS[type];
    if (!def?.sprite) continue;
    for (const version of ["v2", "v1"]) {
      const folder = resolve(base, type, version);
      const packet = await readJson(resolve(folder, "packet.json"));
      if (!packet || packet.runtimeType !== type) continue;
      for (const filename of Object.values(packet.evidence)) {
        if (/^[a-z0-9-]+\.(png|mp4|glb)$/.test(filename)) {
          files.set(`/campaign-review/${type}/${version}/${filename}`, resolve(folder, filename));
        }
      }
      const cameraFolder = resolve(folder, "game-camera");
      const camera = await readJson(resolve(cameraFolder, "packet.json"));
      if (camera?.runtimeType === type) {
        for (const filename of Object.values(camera.evidence)) {
          if (/^[a-z0-9-]+\.(png|mp4)$/.test(filename)) {
            files.set(
              `/campaign-review/${type}/${version}/game-camera/${filename}`,
              resolve(cameraFolder, filename),
            );
          }
        }
      }
      const source = ["model.blend", "cat.blend"];
      for (const filename of source) {
        const file = resolve(folder, filename);
        if ((await stat(file).catch(() => undefined))?.isFile()) {
          files.set(`/campaign-review/${type}/${version}/${filename}`, file);
        }
      }
      const model = Object.values(packet.evidence).find((value) => /^[a-z0-9-]+\.glb$/.test(value));
      if (!model || !packet.fit || registry.has(def.sprite.sheetKey)) continue;
      const [x, y, z] = packet.fit;
      if (![x, y, z].every((value) => Number.isFinite(value) && value > 0)) continue;
      const path = `${MODEL_ROUTE}${type}.glb`;
      const clips = def.sprite.clips ?? packet.runtimeClips;
      if (!clips?.length) continue;
      registry.set(def.sprite.sheetKey, {
        path: path.slice(1),
        // Draft data is already registered in world-pixel units.
        height: 1,
        unitScale: z,
        topDown: { width: x / z, height: y / z },
        animation: { clips, names: packet.modelClips, classicCycle: !def.sprite.clips },
      });
      files.set(path, resolve(folder, model));
    }
  }
  files.set("/campaign-review/", resolve(base, "index.html"));
  return {
    count: registry.size,
    plugin: {
      name: "tilefun-local-wildlife-draft-preview",
      transformIndexHtml() {
        if (!registry.size) return [];
        return [
          {
            tag: "script",
            attrs: { id: "tilefun-wildlife-draft-catalog", type: "application/json" },
            children: JSON.stringify(Object.fromEntries(registry)).replaceAll("<", "\\u003c"),
            injectTo: "head-prepend",
          },
        ];
      },
      configureServer(server) {
        server.middlewares.use(async (request, response, next) => {
          const route = request.url?.split("?")[0]?.replace(/^\/tilefun\//, "/");
          const file = files.get(route);
          if (!file || !["GET", "HEAD"].includes(request.method)) return next();
          const info = await stat(file).catch(() => undefined);
          if (!info?.isFile()) return next();
          response.setHeader("Content-Type", TYPES[suffix(file)]);
          response.setHeader("Content-Length", info.size);
          response.setHeader("Cache-Control", "no-store");
          if (request.method === "HEAD") response.end();
          else createReadStream(file).pipe(response);
        });
      },
    },
  };
}
