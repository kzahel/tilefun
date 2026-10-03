import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { deserialize, serialize } from "node:v8";
import { parentPort, workerData } from "node:worker_threads";

let database;
let lease;
let put;
let remove;
let read;
let scan;
let scanScope;

// An OS-backed SQLite exclusive lock survives between transactions and is
// released by process death. No stale PID files or platform-specific flock API.
function open() {
  mkdirSync(workerData.directory, { recursive: true });
  lease = new DatabaseSync(join(workerData.directory, "writer.sqlite"));
  try {
    lease.exec("PRAGMA busy_timeout=0; BEGIN EXCLUSIVE;");
    database = new DatabaseSync(join(workerData.directory, "records.sqlite"));
    database.exec(`
      PRAGMA journal_mode=WAL;
      PRAGMA synchronous=FULL;
      CREATE TABLE IF NOT EXISTS records (
        collection TEXT NOT NULL, key TEXT NOT NULL, scope TEXT,
        payload BLOB NOT NULL, PRIMARY KEY(collection,key)
      ) WITHOUT ROWID;
      CREATE INDEX IF NOT EXISTS records_scope ON records(collection,scope,key);
    `);
    put = database.prepare("INSERT OR REPLACE INTO records VALUES (?,?,?,?)");
    remove = database.prepare("DELETE FROM records WHERE collection=? AND key=?");
    read = database.prepare("SELECT payload FROM records WHERE collection=? AND key=?");
    scan = database.prepare(
      "SELECT payload FROM records WHERE collection=? AND key>? ORDER BY key LIMIT ?",
    );
    scanScope = database.prepare(
      "SELECT payload FROM records WHERE collection=? AND scope=? AND key>? ORDER BY key LIMIT ?",
    );
  } catch (error) {
    database?.close();
    lease.close();
    throw error;
  }
}

parentPort.on("message", ({ id, operation, value }) => {
  try {
    let result;
    switch (operation) {
      case "open":
        open();
        break;
      case "read": {
        const row = read.get(value.collection, value.key);
        result = row ? deserialize(row.payload) : undefined;
        break;
      }
      case "scan": {
        const rows =
          value.scope === undefined
            ? scan.all(value.collection, value.after ?? "", value.limit)
            : scanScope.all(value.collection, value.scope, value.after ?? "", value.limit);
        result = rows.map((row) => deserialize(row.payload));
        break;
      }
      case "commit":
        database.exec("BEGIN IMMEDIATE");
        try {
          for (const mutation of value) {
            if (mutation.put) {
              const record = mutation.put;
              put.run(record.collection, record.key, record.scope ?? null, serialize(record));
            } else remove.run(mutation.delete.collection, mutation.delete.key);
          }
          database.exec("COMMIT");
        } catch (error) {
          database.exec("ROLLBACK");
          throw error;
        }
        break;
      case "close":
        database.close();
        lease.close();
        break;
      default:
        throw new Error("Unknown storage operation.");
    }
    parentPort.postMessage({ id, value: result });
  } catch (error) {
    parentPort.postMessage({ id, error: String(error) });
  }
});
