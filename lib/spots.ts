export type Spot = {
  id: string;
  name: string;
  description: string;
  image: string;
  points: number;
  /** 終極任務（不計入「至少 3 個一般景點」） */
  ultimate?: boolean;
  /** 特級任務：心得（不計入「至少 3 個一般景點」） */
  special?: boolean;
  /** 心得至少字數（不含標點），與 `special` 併用 */
  reflectionMinChars?: number;
};

/** 計入「解鎖 IG 拼貼需完成至少 3 處」的景點（不含終極、特級） */
export function countsTowardMinimumThree(spot: Spot): boolean {
  return !spot.ultimate && !spot.special;
}
