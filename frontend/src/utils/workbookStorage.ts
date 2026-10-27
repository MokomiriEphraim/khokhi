// IndexedDB helper for persisting student active spreadsheet workbooks across page refreshes
const DB_NAME = 'khokhi_workbook_store';
const STORE_NAME = 'active_workbooks';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported'));
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'userId' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export interface StoredWorkbookRecord {
  userId: string;
  fileName: string;
  buffer: ArrayBuffer;
  instructions?: string;
  savedAt: number;
}

export async function saveActiveWorkbookToLocal(
  userId: string,
  fileName: string,
  buffer: ArrayBuffer,
  instructions?: string
): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put({
      userId,
      fileName,
      buffer: buffer.slice(0),
      instructions: instructions || '',
      savedAt: Date.now(),
    });
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Could not persist workbook to IndexedDB:', err);
  }
}

export async function getActiveWorkbookFromLocal(
  userId: string
): Promise<StoredWorkbookRecord | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(userId);
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('Could not retrieve workbook from IndexedDB:', err);
    return null;
  }
}

export async function clearActiveWorkbookFromLocal(userId: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(userId);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Could not clear workbook from IndexedDB:', err);
  }
}
