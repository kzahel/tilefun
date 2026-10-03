import { RecordPersistenceStore } from "./RecordPersistenceStore.js";
import { SqliteRecordStore } from "./SqliteRecordStore.js";

export class SqlitePersistenceStore extends RecordPersistenceStore {
  constructor(directory: string) {
    super(new SqliteRecordStore(directory));
  }
}
