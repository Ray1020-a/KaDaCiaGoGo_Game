import { getDb } from "@/lib/db";
import { normalizeRealName, REAL_NAME_ERROR } from "@/lib/name-rules";

/** 補登真名（舊版僅有用戶代碼時） */
export async function POST(request: Request) {
  let body: { userCode?: string; realName?: string };
  try {
    body = (await request.json()) as { userCode?: string; realName?: string };
  } catch {
    return Response.json({ error: "無效的 JSON" }, { status: 400 });
  }
  const userCode = typeof body.userCode === "string" ? body.userCode.trim() : "";
  const realName = normalizeRealName(body.realName);
  if (!userCode) {
    return Response.json({ error: "缺少用戶代碼" }, { status: 400 });
  }
  if (!realName) {
    return Response.json({ error: REAL_NAME_ERROR }, { status: 400 });
  }

  const db = getDb();
  const row = db
    .prepare("SELECT id FROM users WHERE user_code = ?")
    .get(userCode) as { id: number } | undefined;
  if (!row) {
    return Response.json({ error: "用戶不存在" }, { status: 404 });
  }

  db.prepare("UPDATE users SET real_name = ? WHERE user_code = ?").run(
    realName,
    userCode,
  );
  return Response.json({ ok: true, realName });
}
