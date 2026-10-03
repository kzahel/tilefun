import { IdbRecordStore } from "./IdbRecordStore.js";
import { RecordPersistenceStore } from "./RecordPersistenceStore.js";

export class IdbPersistenceStore extends RecordPersistenceStore {
  constructor(name: string, _collections?: string[], readOnly = false) {
    super(new IdbRecordStore(`${name}-records-v2`, readOnly));
  }
}
