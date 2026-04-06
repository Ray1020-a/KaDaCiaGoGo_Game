import {
  parseStoredGameJson,
  thinStateForStorage,
  type LocalGameState,
} from "@/lib/local-game";

const DB_NAME = "kadaciagogo_photos_v1";
/** v2：新增 meta 存完整遊戲狀態（JSON），避免 iOS localStorage 配額／不穩定 */
const DB_VERSION = 2;
const STORE_PHOTOS = "photos";
const STORE_META = "meta";
const META_KEY_GAME = "game";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error("idb"));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_PHOTOS)) {
        db.createObjectStore(STORE_PHOTOS);
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META);
      }
    };
  });
}

export async function putPhoto(spotId: string, dataUrl: string): Promise<boolean> {
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_PHOTOS, "readwrite");
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
      tx.objectStore(STORE_PHOTOS).put(dataUrl, spotId);
    });
  } catch {
    return false;
  }
}

export async function getPhoto(spotId: string): Promise<string | null> {
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_PHOTOS, "readonly");
      const req = tx.objectStore(STORE_PHOTOS).get(spotId);
      req.onsuccess = () => resolve((req.result as string | undefined) ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function deletePhoto(spotId: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_PHOTOS, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new Error("abort"));
      tx.objectStore(STORE_PHOTOS).delete(spotId);
    });
  } catch {
    /* ignore */
  }
}

/** 無 meta 紀錄時回傳 null（與空進度不同：空進度也會寫入一筆） */
export async function getGameStateFromIdb(): Promise<LocalGameState | null> {
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_META, "readonly");
      const req = tx.objectStore(STORE_META).get(META_KEY_GAME);
      req.onsuccess = () => {
        const v = req.result;
        if (v === undefined) {
          resolve(null);
          return;
        }
        if (typeof v !== "string") {
          resolve(null);
          return;
        }
        resolve(parseStoredGameJson(v));
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function setGameStateToIdb(state: LocalGameState): Promise<boolean> {
  try {
    const thin = thinStateForStorage(state);
    const json = JSON.stringify(thin);
    const db = await openDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_META, "readwrite");
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
      tx.objectStore(STORE_META).put(json, META_KEY_GAME);
    });
  } catch {
    return false;
  }
}

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
