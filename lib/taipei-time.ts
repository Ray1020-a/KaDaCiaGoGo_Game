/** 台灣台北時間 UTC+8（無夏令時間） */

export function nowTaipeiSqlite(): string {
  return new Date()
    .toLocaleString("sv-SE", { timeZone: "Asia/Taipei" })
    .replace("T", " ");
}

/** 顯示用：資料庫內 YYYY-MM-DD HH:MM:SS 或 ISO 字串 → 台北時間字串 */
export function formatTaipeiDisplay(raw: string | null | undefined): string {
  if (!raw) return "";
  const s = raw.trim().replace("T", " ");
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(s)) {
    return s.slice(0, 16);
  }
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) {
    return d
      .toLocaleString("zh-TW", {
        timeZone: "Asia/Taipei",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
      .replace(/\//g, "-");
  }
  return s;
}
