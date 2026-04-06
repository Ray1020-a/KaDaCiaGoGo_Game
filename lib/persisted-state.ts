import {
  emptyState,
  loadState,
  saveState,
  type LocalGameState,
  STORAGE_KEY,
} from "@/lib/local-game";
import { getGameStateFromIdb, setGameStateToIdb } from "@/lib/photo-idb";

function hasAnyProgress(s: LocalGameState): boolean {
  if (s.userCode) return true;
  return Object.keys(s.spots).length > 0;
}

/**
 * 優先自 IndexedDB 讀取（iOS 上 localStorage 極易滿或不可靠），否則讀舊版 localStorage 並遷移。
 */
export async function loadPersistedState(): Promise<LocalGameState> {
  if (typeof window === "undefined") return emptyState();
  const fromIdb = await getGameStateFromIdb();
  if (fromIdb !== null) {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    return fromIdb;
  }
  const legacy = loadState();
  if (hasAnyProgress(legacy)) {
    await persistGameState(legacy);
  }
  return legacy;
}

/**
 * 先寫 IndexedDB，失敗時退回 localStorage（私密模式／極端環境）。
 */
export async function persistGameState(state: LocalGameState): Promise<boolean> {
  const idbOk = await setGameStateToIdb(state);
  if (idbOk) {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    return true;
  }
  return saveState(state);
}
