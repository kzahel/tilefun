import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const cli =
  process.env.MACHINE_CONTROL_CLI ??
  path.join(homedir(), "code/machine-control/bin/machine-control");
const target = process.env.TILEFUN_DECK_TARGET ?? "steamdeck";
const manifest = path.join(root, "scripts/steam-deck/manifest.json");
const command = process.argv[2] ?? "status";
function run(args) {
  const result = spawnSync(cli, ["--target", target, ...args], { stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
if (command === "doctor") run(["inventory", "doctor", target]);
else if (command === "install") run(["testbed", "--", "install", manifest]);
else if (command === "launch") run(["testbed", "--", "launch", "tilefun"]);
else if (command === "status") run(["testbed", "--", "status", "--json"]);
else throw Error("Use doctor, install, launch or status");
