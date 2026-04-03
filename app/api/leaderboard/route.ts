import { getDb } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(
    100,
    Math.max(1, Number(searchParams.get("limit") ?? "30") || 30),
  );

  const db = getDb();
  const rows = db
    .prepare(
      `SELECT c.user_code,
              u.real_name,
              COALESCE(SUM(c.points), 0) AS total_points,
              COUNT(*) AS checkin_count,
              MAX(c.checked_at) AS last_checkin
       FROM checkins c
       LEFT JOIN users u ON u.user_code = c.user_code
       GROUP BY c.user_code
       ORDER BY total_points DESC, last_checkin ASC
       LIMIT ?`,
    )
    .all(limit) as Array<{
    user_code: string;
    real_name: string | null;
    total_points: number;
    checkin_count: number;
    last_checkin: string;
  }>;

  return Response.json({ leaderboard: rows });
}
