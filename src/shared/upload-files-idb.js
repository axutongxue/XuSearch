

const DB_NAME = "xuSearch-upload-files";
const DB_VERSION = 1;
const STORE_NAME = "files";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}


export async function saveFilesToIDB(files) {
  const sessionId = `upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const db = await openDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put({
      id: sessionId,
      files: [...files],
      createdAt: Date.now(),
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();

  return sessionId;
}


export async function loadFilesFromIDB(sessionId) {
  const db = await openDB();
  const record = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(sessionId);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
  db.close();

  if (!record || !Array.isArray(record.files) || record.files.length === 0) {
    return null;
  }

  
  const db2 = await openDB();
  await new Promise((resolve, reject) => {
    const tx = db2.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(sessionId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db2.close();

  return record.files;
}


export async function clearStaleIDBFiles() {
  try {
    const db = await openDB();
    const deadline = Date.now() - 3600000; 
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => {
      const records = req.result || [];
      for (const record of records) {
        if (record.createdAt && record.createdAt < deadline) {
          store.delete(record.id);
        }
      }
    };
    tx.oncomplete = () => db.close();
    tx.onerror = () => db.close();
  } catch (_e) {
    
  }
}
