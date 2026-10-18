import { execFileSync } from "node:child_process";
import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { packager } from "@electron/packager";

const root = fileURLToPath(new URL("../", import.meta.url));
const target = process.argv.includes("--linux") ? "linux" : process.platform;
const arch = target === "linux" ? "x64" : process.arch;
const staging = path.join(root, "dist", "desktop-source");
await rm(staging, { recursive: true, force: true });
await mkdir(staging, { recursive: true });
await cp(path.join(root, "desktop"), staging, { recursive: true });
await mkdir(path.join(staging, "www"), { recursive: true });
for (const name of await readdir(path.join(root, "dist"))) {
  if (["desktop-source", "desktop"].includes(name)) continue;
  await cp(path.join(root, "dist", name), path.join(staging, "www", name), { recursive: true });
}

const electronVersion = JSON.parse(
  await readFile(path.join(root, "node_modules/electron/package.json"), "utf8"),
).version;
const outputs = await packager({
  dir: staging,
  out: path.join(root, "dist", "desktop"),
  name: "Tilefun",
  executableName: "tilefun",
  platform: target,
  arch,
  electronVersion,
  overwrite: true,
  asar: true,
  prune: false,
});
const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
const dirty =
  execFileSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" }).trim().length > 0;
for (const output of outputs) {
  await writeFile(
    path.join(output, "build.json"),
    `${JSON.stringify({ commit, dirty, electronVersion, platform: target, arch }, null, 2)}\n`,
  );
  if (target === "linux")
    await cp(path.join(root, "desktop", "run.sh"), path.join(output, "run.sh"));
}
console.log(outputs.join("\n"));
