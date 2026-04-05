export type Spot = {
  id: string;
  name: string;
  description: string;
  image: string;
  points: number;
  /** 終極任務（不計入解鎖拼貼所統計的一般景點） */
  ultimate?: boolean;
  /** 特級任務：心得（不計入解鎖拼貼所統計的一般景點） */
  special?: boolean;
  /** 心得至少字數（不含標點），與 `special` 併用 */
  reflectionMinChars?: number;
};

/** 計入解鎖圖片拼貼門檻的一般景點（不含終極、特級） */
export function countsTowardMinimumThree(spot: Spot): boolean {
  return !spot.ultimate && !spot.special;
}
