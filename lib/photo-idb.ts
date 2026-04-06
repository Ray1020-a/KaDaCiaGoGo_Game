import type { LocalGameState } from "@/lib/local-game";

const DB_NAME = "kadaciagogo_photos_v1";
const STORE = "photos";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onerror = () => reject(req.error ?? new Error("idb"));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
  });
}

export async function putPhoto(spotId: string, dataUrl: string): Promise<boolean> {
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
      tx.objectStore(STORE).put(dataUrl, spotId);
    });
  } catch {
    return false;
  }
}

export async function getPhoto(spotId: string): Promise<string | null> {
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(spotId);
      req.onsuccess = () => resolve((req.result as string | undefined) ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/** localStorage 寫入失敗時用於回滾，避免 IDB 有照片但畫面未勾選已完成 */
export async function deletePhoto(spotId: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new Error("abort"));
      tx.objectStore(STORE).delete(spotId);
    });
  } catch {
    /* ignore */
  }
}

/**
 * 將 localStorage 內嵌之照片遷入 IDB，並自 IDB 補齊僅有 photoInIdb 之景點。
 */
export async function hydratePhotosIntoState(
  state: LocalGameState,
): Promise<LocalGameState> {
  const spots = { ...state.spots };
  for (const id of Object.keys(spots)) {
    let p = spots[id];
    if (!p) continue;
    if (p.photoDataUrl) {
      const ok = await putPhoto(id, p.photoDataUrl);
      if (ok) {
        p = { ...p, photoInIdb: true };
        spots[id] = p;
      }
    }
    p = spots[id];
    if (!p) continue;
    if (p.photoInIdb && !p.photoDataUrl) {
      const url = await getPhoto(id);
      if (url) spots[id] = { ...p, photoDataUrl: url };
    }
  }
  return { ...state, spots };
}
