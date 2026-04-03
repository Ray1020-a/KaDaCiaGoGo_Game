#!/usr/bin/env node
/**
 * 活動結束後回顧：讀取 SQLite（users / checkins）
 * 用法：
 *   node scripts/sqlite-stats.mjs
 *   node scripts/sqlite-stats.mjs --global
 *   node scripts/sqlite-stats.mjs --user AB12CD34EF
 *   node scripts/sqlite-stats.mjs --leaderboard 20
 *   node scripts/sqlite-stats.mjs --users
 *   node scripts/sqlite-stats.mjs --reflections
 */
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const dbPath = path.join(root, "data", "game.db");

/** 終端顯示：台北時間（資料庫為 UTC+8 字串或 ISO） */
function fmtTaipei(raw) {
  if (raw == null || raw === "") return "";
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(s)) {
    return s.length >= 16 ? s.slice(0, 16) : s;
  }
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleString("zh-TW", {
      timeZone: "Asia/Taipei",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }
  return s;
}

function parseArgs(argv) {
  let mode = "all";
  let user = null;
  let leaderboardLimit = 30;
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") return { help: true };
    if (a === "--global") {
      mode = "global";
    } else if (a === "--leaderboard") {
      mode = "leaderboard";
      const n = Number(argv[i + 1]);
      if (Number.isFinite(n) && n > 0) {
        leaderboardLimit = n;
        i++;
      }
    } else if (a === "--user") {
      mode = "user";
      user = argv[++i] ?? "";
    } else if (a === "--users") {
      mode = "users";
    } else if (a === "--reflections") {
      mode = "reflections";
    }
  }
  return { mode, user, leaderboardLimit, help: false };
}

function printHelp() {
  console.log(`kadaciagogo SQLite 報表

若未帶參數，會輸出：全域摘要 + 排行榜。

選項：
  --global              僅輸出全域統計
  --users               列出所有用戶（含用戶代碼、姓名、註冊時間）
  --user <CODE>         僅輸出該用戶打卡明細、心得與總分
  --reflections         列出所有特級任務心得全文
  --leaderboard [n]     僅輸出排行榜前 n 名（預設 30）
  -h, --help            說明
`);
}

function printGlobal(db) {
  const userCount = db.prepare("SELECT COUNT(*) AS c FROM users").get().c;
  const checkinCount = db.prepare("SELECT COUNT(*) AS c FROM checkins").get().c;
  const sumPoints = db
    .prepare("SELECT COALESCE(SUM(points),0) AS s FROM checkins")
    .get().s;
  console.log("=== 全域 ===");
  console.log("用戶數：", userCount);
  console.log("打卡筆數：", checkinCount);
  console.log("累計發放積分：", sumPoints);
  console.log("");
}

function printLeaderboard(db, limit) {
  const rows = db
    .prepare(
      `SELECT c.user_code,
              u.real_name,
              COALESCE(SUM(c.points),0) AS total_points,
              COUNT(*) AS spots,
              MIN(c.checked_at) AS first_at,
              MAX(c.checked_at) AS last_at
       FROM checkins c
       LEFT JOIN users u ON u.user_code = c.user_code
       GROUP BY c.user_code
       ORDER BY total_points DESC, last_at ASC
       LIMIT ?`,
    )
    .all(limit);
  console.log(`=== 排行榜（前 ${limit} 名）===`);
  console.log("（時間為台北時間 UTC+8）\n");
  rows.forEach((r, i) => {
    const name = r.real_name?.trim() || "（未填）";
    console.log(
      `${String(i + 1).padStart(3, " ")}  ${name}  積分 ${r.total_points}  景點數 ${r.spots}  首打 ${fmtTaipei(r.first_at)}  末打 ${fmtTaipei(r.last_at)}`,
    );
  });
  console.log("");
}

function printAllUsers(db) {
  const rows = db
    .prepare(
      `SELECT id, user_code, real_name, created_at FROM users ORDER BY id ASC`,
    )
    .all();
  console.log("=== 所有用戶 ===");
  console.log("（註冊時間為台北時間 UTC+8）\n");
  console.log(`共 ${rows.length} 人\n`);
  rows.forEach((r) => {
    const name = r.real_name?.trim() || "（未填姓名）";
    console.log(
      `  id ${String(r.id).padStart(4, " ")}  用戶代碼 ${r.user_code}  姓名 ${name}  註冊 ${fmtTaipei(r.created_at)}`,
    );
  });
  console.log("");
}

function printUser(db, code) {
  console.log("=== 用戶 ===");
  const u = db.prepare("SELECT * FROM users WHERE user_code = ?").get(code);
  if (!u) {
    console.log("查無此用戶代碼：", code);
    console.log("");
    return;
  }
  console.log(u);
  const rows = db
    .prepare(
      `SELECT spot_id, points, checked_at FROM checkins WHERE user_code = ? ORDER BY checked_at`,
    )
    .all(code);
  const total = rows.reduce((s, r) => s + r.points, 0);
  console.log("打卡明細：");
  rows.forEach((r) => {
    console.log(`  ${fmtTaipei(r.checked_at)}  ${r.spot_id}  +${r.points}`);
  });
  console.log("總積分：", total);
  console.log("");
  printReflectionsForUser(db, code);
}

function printReflectionsForUser(db, userCode) {
  let rows;
  try {
    rows = db
      .prepare(
        `SELECT spot_id, body, submitted_at FROM reflections WHERE user_code = ? ORDER BY submitted_at`,
      )
      .all(userCode);
  } catch {
    console.log("（尚無心得資料表，請先啟動過新版網頁以更新資料庫）\n");
    return;
  }
  if (!rows.length) {
    console.log("心得：無紀錄\n");
    return;
  }
  console.log("=== 心得（特級任務）===");
  rows.forEach((r) => {
    console.log(`\n--- ${r.spot_id}  @ ${fmtTaipei(r.submitted_at)} ---`);
    console.log(r.body);
  });
  console.log("");
}

function printAllReflections(db) {
  let rows;
  try {
    rows = db
      .prepare(
        `SELECT r.user_code, u.real_name, r.spot_id, r.submitted_at, r.body
         FROM reflections r
         LEFT JOIN users u ON u.user_code = r.user_code
         ORDER BY r.submitted_at ASC`,
      )
      .all();
  } catch {
    console.log(
      "尚無 reflections 表或無法讀取。請先執行過網頁（npm run dev）以建立資料表，並有學員提交心得。",
    );
    console.log("");
    return;
  }
  console.log("=== 所有用戶心得（特級任務）===");
  console.log("（時間為台北時間 UTC+8）\n");
  console.log(`共 ${rows.length} 篇\n`);
  rows.forEach((r) => {
    const name = r.real_name?.trim() || "（未填）";
    console.log(
      `${"=".repeat(72)}\n用戶代碼 ${r.user_code}  姓名 ${name}  景點 ${r.spot_id}  時間 ${fmtTaipei(r.submitted_at)}\n${"=".repeat(72)}`,
    );
    console.log(r.body);
    console.log("");
  });
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printHelp();
    process.exit(0);
  }

  if (!fs.existsSync(dbPath)) {
    console.error("找不到資料庫：", dbPath);
    console.error("請先在專案目錄執行過網頁並觸發 API，或確認 data/game.db 是否存在。");
    process.exit(1);
  }

  const db = new Database(dbPath, { readonly: true });

  switch (args.mode) {
    case "global":
      printGlobal(db);
      break;
    case "leaderboard":
      printLeaderboard(db, args.leaderboardLimit);
      break;
    case "user":
      printUser(db, args.user ?? "");
      break;
    case "users":
      printAllUsers(db);
      break;
    case "reflections":
      printAllReflections(db);
      break;
    default:
      printGlobal(db);
      printLeaderboard(db, args.leaderboardLimit);
      console.log(
        "提示：--users 列出所有用戶代碼；--user <CODE> 查單一用戶；--reflections 查全部心得",
      );
  }

  db.close();
}

main();
