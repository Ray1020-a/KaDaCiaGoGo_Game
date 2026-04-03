import { customAlphabet } from "nanoid";
import { getDb } from "@/lib/db";
import { normalizeRealName, REAL_NAME_ERROR } from "@/lib/name-rules";
import { nowTaipeiSqlite } from "@/lib/taipei-time";

const codeAlphabet = customAlphabet("23456789ABCDEFGHJKLMNPQRSTUVWXYZ", 10);

export async function POST(request: Request) {
  let body: { realName?: string };
  try {
    body = (await request.json()) as { realName?: string };
  } catch {
    return Response.json({ error: "無效的 JSON" }, { status: 400 });
  }
  const realName = normalizeRealName(body.realName);
  if (!realName) {
    return Response.json({ error: REAL_NAME_ERROR }, { status: 400 });
  }

  const userCode = codeAlphabet();
  const db = getDb();
  const createdAt = nowTaipeiSqlite();
  db.prepare(
    "INSERT INTO users (user_code, real_name, created_at) VALUES (?, ?, ?)",
  ).run(userCode, realName, createdAt);
  return Response.json({ userCode, realName });
}
