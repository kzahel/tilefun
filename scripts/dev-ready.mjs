import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";

// Resolve from this script so invocation does not depend on the caller's directory.
await writeFile(
  new URL("../.tilefun-dev-ready", import.meta.url),
  `${JSON.stringify({ id: randomUUID(), completedAt: new Date().toISOString() })}\n`,
);
console.log("Marked development changes ready to try. Players choose when to reload.");
