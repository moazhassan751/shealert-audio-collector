const DB_NAME = "shealert-pending";
const STORE = "recordings";
const TEST_STORE = "tests";

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: "id" });
      if (!request.result.objectStoreNames.contains(TEST_STORE)) request.result.createObjectStore(TEST_STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function savePending(item) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, "readwrite").objectStore(STORE).put(item);
    request.onsuccess = resolve; request.onerror = () => reject(request.error);
  });
}

export async function removePending(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, "readwrite").objectStore(STORE).delete(id);
    request.onsuccess = resolve; request.onerror = () => reject(request.error);
  });
}

export async function getPending() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
    request.onsuccess = () => resolve(request.result || []); request.onerror = () => reject(request.error);
  });
}

export async function saveLocalTest(item) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(TEST_STORE, "readwrite").objectStore(TEST_STORE).put(item);
    request.onsuccess = resolve; request.onerror = () => reject(request.error);
  });
}
