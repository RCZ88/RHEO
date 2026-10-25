// Thin wrapper around IndexedDB for storing blobs (photos, videos, voice
// notes) entirely on-device. Each storeName is a separate object store,
// keyed by string id. All data stays in the browser -- nothing is uploaded.

const DB_NAME = 'deskflow-blob-store';
const DB_VERSION = 2;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      // Create all known object stores if they don't already exist.
      for (const name of ['memories', 'voiceNotes', 'memory-groups']) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: 'id' });
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

interface BlobRecord<T = unknown> {
  id: string;
  blob: Blob;
  meta: T;
  createdAt: number;
}

export async function putBlobRecord<T>(storeName: string, record: BlobRecord<T>): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(record);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function getBlobRecord<T>(storeName: string, id: string): Promise<BlobRecord<T> | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).get(id);
    req.onsuccess = () => { db.close(); resolve(req.result ?? null); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

export async function listBlobRecords<T>(storeName: string): Promise<BlobRecord<T>[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => { db.close(); resolve(req.result ?? []); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

export async function deleteBlobRecord(storeName: string, id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).delete(id);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}
