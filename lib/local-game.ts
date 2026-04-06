import { type Spot, countsTowardMinimumThree } from "@/lib/spots";
import { countReflectionCharsExcludingPunctuation } from "@/lib/reflection-count";

export const STORAGE_KEY = "kadaciagogo_day3_2026";

export type SpotProgress = {
  introRead: boolean;
  /** 壓縮後的 JPEG data URL，供拼貼與離線顯示（執行期；持久化時改存 IndexedDB） */
  photoDataUrl?: string;
  /** 照片已寫入 IndexedDB（localStorage 不再存 base64） */
  photoInIdb?: boolean;
  completedAt?: string;
  /** 特級任務心得全文 */
  reflectionText?: string;
};

export type LocalGameState = {
  version: 2;
  userCode: string | null;
  /** 伺服器登記之真實姓名（不顯示用戶代碼給使用者） */
  realName: string | null;
  spots: Record<string, SpotProgress>;
};

export function loadState(): LocalGameState {
  if (typeof window === "undefined") {
    return emptyState();
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed.version === 1) {
      const p = parsed as {
        version: 1;
        userCode?: string | null;
        spots?: Record<string, SpotProgress>;
      };
      return {
        version: 2,
        userCode: p.userCode ?? null,
        realName: null,
        spots: p.spots ?? {},
      };
    }
    if (parsed.version !== 2) return emptyState();
    const p = parsed as LocalGameState;
    return {
      version: 2,
      userCode: p.userCode ?? null,
      realName: p.realName ?? null,
      spots: p.spots ?? {},
    };
  } catch {
    return emptyState();
  }
}

export function emptyState(): LocalGameState {
  return { version: 2, userCode: null, realName: null, spots: {} };
}

/**
 * 寫入 localStorage（不含 base64）。若僅有 photoDataUrl 未寫入 IDB，仍保留內嵌以兼容舊資料。
 */
export function thinStateForStorage(state: LocalGameState): LocalGameState {
  return {
    ...state,
    spots: Object.fromEntries(
      Object.entries(state.spots).map(([id, p]) => {
        if (!p) return [id, p];
        if (p.photoInIdb && p.photoDataUrl) {
          const { photoDataUrl: _d, ...rest } = p;
          return [id, { ...rest, photoInIdb: true }];
        }
        return [id, p];
      }),
    ),
  };
}

/** @returns 是否成功寫入（配額不足等會回傳 false，不拋錯） */
export function saveState(state: LocalGameState): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(thinStateForStorage(state)));
    return true;
  } catch {
    return false;
  }
}

export function isSpotCompleted(state: LocalGameState, spot: Spot): boolean {
  const p = state.spots[spot.id];
  if (!p) return false;
  if (spot.special && spot.reflectionMinChars) {
    return (
      countReflectionCharsExcludingPunctuation(p.reflectionText ?? "") >=
      spot.reflectionMinChars
    );
  }
  return Boolean(p.photoDataUrl || p.photoInIdb);
}

export function completedCount(state: LocalGameState, spots: Spot[]) {
  return spots.filter((s) => isSpotCompleted(state, s)).length;
}

/** 僅一般景點（不含終極、特級）完成數 */
export function mainTrackCompletedCount(state: LocalGameState, spots: Spot[]) {
  return spots.filter(
    (s) => countsTowardMinimumThree(s) && isSpotCompleted(state, s),
  ).length;
}

export function mainTrackSpotCount(spots: Spot[]) {
  return spots.filter(countsTowardMinimumThree).length;
}

/** 解鎖圖片拼貼：至少完成之一般景點數（終極／特級不計入） */
export const COLLAGE_MIN_GENERAL_SPOTS = 6;

/** 至少完成 {@link COLLAGE_MIN_GENERAL_SPOTS} 個一般景點拍照，才可製作 IG 拼貼（終極／特級不計入） */
export function canEarlyCollage(state: LocalGameState, spots: Spot[]) {
  return mainTrackCompletedCount(state, spots) >= COLLAGE_MIN_GENERAL_SPOTS;
}
