/** 真實姓名：2～3 個繁簡中文字，禁止匿名／測試等 */

const BANNED = new Set([
  "匿名",
  "無名",
  "無",
  "不詳",
  "佚名",
  "測試",
  "某人",
  "某某",
  "無名氏",
  "test",
  "guest",
  "null",
  "none",
  "admin",
]);

/** 僅允許中日韓統一漢字區常見字（2～3 字） */
const HAN2_3 = /^[\u4e00-\u9fff]{2,3}$/;

export function normalizeRealName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim().replace(/\s/g, "");
  if (!HAN2_3.test(s)) return null;
  if (BANNED.has(s) || BANNED.has(s.toLowerCase())) return null;
  return s;
}

export const REAL_NAME_ERROR =
  "請輸入 2～3 個字中文姓名，不可使用匿名、測試等字樣";
