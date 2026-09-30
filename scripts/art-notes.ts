import { randomUUID } from "node:crypto";
import { latestArtNotes } from "../src/art/ArtNotes.js";
import { ArtNoteStore } from "../src/server/artNotesHttp.js";

const store = new ArtNoteStore();
const args = process.argv.slice(2);
const rows = latestArtNotes(await store.records());
if (args[0] === "set-status") {
  const thread = rows.find((r) => r.threadId === args[1]);
  if (!thread) throw new Error("Unknown note thread");
  const row = {
    ...thread,
    id: randomUUID(),
    status: args[2],
    reply: args[3] ?? thread.reply,
    createdAt: new Date().toISOString(),
  };
  await store.append(row);
  console.log(`Saved ${thread.threadId}: ${args[2]}`);
} else {
  const status = args.find((a) => a.startsWith("--status="))?.split("=")[1] ?? "pending";
  const selected = rows.filter((r) => status === "all" || r.status === status);
  if (args.includes("--json")) console.log(JSON.stringify(selected, null, 2));
  else {
    const catalog = await store.catalog();
    for (const row of selected) {
      if (row.buildingReview)
        console.log(
          `Building review: ${row.buildingReview.url}\nrecipes=${row.buildingReview.prefabIds.join(", ")}\ncomposition=${row.buildingReview.revision}`,
        );
      const sheet = catalog.sheets.find((s) => s.id === row.sheetId);
      console.log(
        `\n${row.threadId} [${row.status}/${row.intent}]\n${sheet?.image ?? row.sheetId} rect=${JSON.stringify(row.rect)}\nrevision=${row.fingerprint}${sheet?.fingerprint !== row.fingerprint ? " (CHANGED SOURCE)" : ""}\nslices=${row.sliceKeys.join(", ")}\n${row.note}${row.reply ? `\nReply: ${row.reply}` : ""}`,
      );
    }
    console.log(`\n${selected.length} ${status} notes.`);
  }
}
