import { IdbRecordStore } from "./IdbRecordStore.js";
import { RecordPersistenceStore } from "./RecordPersistenceStore.js";
import { RECORD_DATABASE_SUFFIX } from "./SaveFormat.js";

export class IdbPersistenceStore extends RecordPersistenceStore {
  constructor(name: string, _collections?: string[], readOnly = false) {
    super(new IdbRecordStore(`${name}${RECORD_DATABASE_SUFFIX}`, readOnly));
  }
}
