import { WorkshopService } from "../src/server/workshopService.js";

const inbox = await new WorkshopService().inbox();
if (process.argv.includes("--json")) console.log(JSON.stringify(inbox, null, 2));
else {
  console.log(
    `Workshop manifest: ${inbox.manifestCurrent ? "current" : "STALE — regenerate before review"}`,
  );
  for (const batch of [...new Set(inbox.candidates.map((c) => c.batchId))]) {
    const rows = inbox.candidates.filter((c) => c.batchId === batch);
    const counts = ["unchecked", "changed", "approved", "changes", "excluded"]
      .map((state) => `${rows.filter((c) => c.state === state).length} ${state}`)
      .join(" · ");
    console.log(`${batch}: ${counts}`);
  }
  console.log(`\n${inbox.requests.length} pending requests / fixes`);
  for (const thread of inbox.requests)
    console.log(
      `\n${thread.id} [${thread.status}] ${thread.name}\n${thread.note}${thread.reply ? `\nReply: ${thread.reply}` : ""}\n${thread.url}`,
    );
}
