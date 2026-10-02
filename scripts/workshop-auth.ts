import { randomBytes } from "node:crypto";
import { chmod, mkdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { hashWorkshopPassword, WorkshopAuth } from "../src/server/workshopAuth.js";

const auth = new WorkshopAuth(),
  command = process.argv[2] ?? "status";
if (command === "status")
  console.log(
    (await auth.config())
      ? "Workshop owner login is configured."
      : "Workshop owner login is not configured.",
  );
else if (command === "setup" || command === "reset") {
  if (command === "setup" && (await auth.config()))
    throw new Error(
      "Already configured; use reset to replace the password and revoke existing sessions.",
    );
  // Never accept a password as a command-line argument (shell history/process list).
  const password = process.env.WORKSHOP_SETUP_PASSWORD ?? randomBytes(24).toString("base64url");
  const username = process.env.WORKSHOP_OWNER ?? "owner";
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(username)) throw new Error("Invalid owner name");
  await mkdir(auth.directory, { recursive: true, mode: 0o700 });
  await chmod(auth.directory, 0o700);
  await writeFile(
    join(auth.directory, "owner.json"),
    `${JSON.stringify({ version: 1, username, passwordHash: await hashWorkshopPassword(password) })}\n`,
    { mode: 0o600 },
  );
  await chmod(join(auth.directory, "owner.json"), 0o600);
  if (!process.env.WORKSHOP_SETUP_PASSWORD) {
    const file = join(auth.directory, "initial-login.txt");
    await writeFile(
      file,
      `Tilefun Workshop\nUsername: ${username}\nPassword: ${password}\n\nSave this password in your password manager, then remove this file.\nLogin: https://tilefun.graehlarts.com/tilefun/workshop.html#/login\n`,
      { mode: 0o600 },
    );
    await chmod(file, 0o600);
    console.log(
      `Initial credentials saved privately to ${resolve(file)}. No password was printed.`,
    );
  }
  if (process.env.WORKSHOP_SETUP_PASSWORD)
    await rm(join(auth.directory, "initial-login.txt"), { force: true });
  console.log("Owner login configured. Prior sessions are invalidated by the new password hash.");
} else throw new Error("Use status, setup or reset.");
