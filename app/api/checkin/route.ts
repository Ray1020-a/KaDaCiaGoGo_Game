import { getDb } from "@/lib/db";
import { nowTaipeiSqlite } from "@/lib/taipei-time";

type Body = {
  userCode: string;
  spotId: string;
  points: number;
  /** 特級任務心得（可選，會寫入 SQLite） */
  reflectionText?: string;
};

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ error: "無效的 JSON" }, { status: 400 });
  }
  const { userCode, spotId, points, reflectionText } = body;
  if (!userCode || !spotId || typeof points !== "number") {
    return Response.json({ error: "缺少欄位" }, { status: 400 });
  }

  const db = getDb();
  const user = db
    .prepare("SELECT id FROM users WHERE user_code = ?")
    .get(userCode) as { id: number } | undefined;
  if (!user) {
    return Response.json({ error: "用戶不存在" }, { status: 404 });
  }

  const checkedAt = nowTaipeiSqlite();
  let duplicate = false;
  try {
    db.prepare(
      "INSERT INTO checkins (user_code, spot_id, points, checked_at) VALUES (?, ?, ?, ?)",
    ).run(userCode, spotId, points, checkedAt);
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err.code === "SQLITE_CONSTRAINT_UNIQUE") {
      duplicate = true;
    } else {
      throw e;
    }
  }

  if (typeof reflectionText === "string" && reflectionText.trim().length > 0) {
    const ts = nowTaipeiSqlite();
    db.prepare(
      `INSERT INTO reflections (user_code, spot_id, body, submitted_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(user_code, spot_id) DO UPDATE SET
         body = excluded.body,
         submitted_at = ?`,
    ).run(userCode, spotId, reflectionText.trim(), ts, ts);
  }

  return Response.json({ ok: true, duplicate });
}
