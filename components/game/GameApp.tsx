"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Spot } from "@/lib/spots";
import { fileToCompressedDataUrl } from "@/lib/compress-image";
import {
  COLLAGE_MIN_GENERAL_SPOTS,
  canEarlyCollage,
  isSpotCompleted,
  mainTrackCompletedCount,
  mainTrackSpotCount,
  emptyState,
  type LocalGameState,
} from "@/lib/local-game";
import { loadPersistedState, persistGameState } from "@/lib/persisted-state";
import { countReflectionCharsExcludingPunctuation } from "@/lib/reflection-count";
import { normalizeRealName, REAL_NAME_ERROR } from "@/lib/name-rules";
import { formatTaipeiDisplay, nowTaipeiSqlite } from "@/lib/taipei-time";
import { deletePhoto, hydratePhotosIntoState, putPhoto } from "@/lib/photo-idb";
import { CollageCanvas, type CollageItem } from "./CollageCanvas";
import { IntroAnimation } from "./IntroAnimation";

const INTRO_KEY = "kadaciagogo_intro_seen_v1";

type Tab = "spots" | "leaderboard" | "collage";

type LeaderRow = {
  user_code: string;
  real_name: string | null;
  total_points: number;
  checkin_count: number;
  last_checkin: string;
};

export function GameApp() {
  const [showIntro, setShowIntro] = useState(true);
  const [spots, setSpots] = useState<Spot[]>([]);
  const [local, setLocal] = useState<LocalGameState>(() => emptyState());
  /** 供 mergeLocal 同步讀寫，以取得可靠的儲存成功與否（避免 setState 回呼時序問題） */
  const localRef = useRef<LocalGameState>(emptyState());
  localRef.current = local;
  const [hydrated, setHydrated] = useState(false);
  const [active, setActive] = useState<Spot | null>(null);
  const [tab, setTab] = useState<Tab>("spots");
  const [toast, setToast] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderRow[] | null>(null);
  const [lbLoading, setLbLoading] = useState(false);
  const [regSubmitting, setRegSubmitting] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      try {
        if (localStorage.getItem(INTRO_KEY) === "1") {
          setShowIntro(false);
        }
      } catch {
        /* ignore */
      }
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await fetch("/data/spots.json");
      const j = (await r.json()) as Spot[];
      if (!cancelled) setSpots(j);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void (async () => {
        const raw = await loadPersistedState();
        const merged = await hydratePhotosIntoState(raw);
        localRef.current = merged;
        setLocal(merged);
        await persistGameState(merged);
        setHydrated(true);
      })();
    });
  }, []);

  useEffect(() => {
    if (tab !== "leaderboard" || !hydrated) return;
    let cancelled = false;
    setLbLoading(true);
    setLeaderboard(null);
    (async () => {
      const r = await fetch("/api/leaderboard?limit=50");
      const j = (await r.json()) as { leaderboard: LeaderRow[] };
      if (!cancelled) {
        setLeaderboard(j.leaderboard);
        setLbLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, hydrated]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2400);
  }, []);

  /** @returns 是否成功寫入 IndexedDB（失敗時狀態不會更新） */
  const mergeLocal = useCallback(
    async (updater: (p: LocalGameState) => LocalGameState): Promise<boolean> => {
      const base = localRef.current ?? emptyState();
      const next = updater(base);
      if (!(await persistGameState(next))) {
        queueMicrotask(() =>
          showToast(
            "無法儲存到裝置（空間不足或瀏覽限制）。可嘗試關閉私密瀏覽、釋放手機空間，或清除本站資料後重試。",
          ),
        );
        return false;
      }
      localRef.current = next;
      setLocal(next);
      return true;
    },
    [showToast],
  );

  const onIntroDone = () => {
    try {
      localStorage.setItem(INTRO_KEY, "1");
    } catch {
      /* ignore */
    }
    setShowIntro(false);
  };

  const needsRealName = Boolean(
    hydrated && !normalizeRealName(local.realName ?? ""),
  );

  const submitRealName = async (raw: string) => {
    const name = normalizeRealName(raw);
    if (!name) {
      showToast(REAL_NAME_ERROR);
      return;
    }
    setRegSubmitting(true);
    try {
      const st = localRef.current;
      if (st.userCode) {
        const r = await fetch("/api/profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userCode: st.userCode, realName: name }),
        });
        if (!r.ok) {
          const e = (await r.json()) as { error?: string };
          showToast(e.error ?? "登記失敗");
          return;
        }
        if (await mergeLocal((p) => ({ ...p, realName: name }))) {
          showToast("已登記姓名");
        }
      } else {
        const r = await fetch("/api/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ realName: name }),
        });
        if (!r.ok) {
          const e = (await r.json()) as { error?: string };
          showToast(e.error ?? "註冊失敗");
          return;
        }
        const j = (await r.json()) as { userCode: string; realName: string };
        if (
          await mergeLocal((p) => ({
            ...p,
            userCode: j.userCode,
            realName: j.realName,
          }))
        ) {
          showToast("註冊完成，開始任務吧");
        }
      }
    } finally {
      setRegSubmitting(false);
    }
  };

  const mainDone = useMemo(
    () => (local && spots.length ? mainTrackCompletedCount(local, spots) : 0),
    [local, spots],
  );
  const mainTotal = useMemo(
    () => (spots.length ? mainTrackSpotCount(spots) : 0),
    [spots],
  );

  const canCollage = useMemo(
    () => Boolean(local && spots.length && canEarlyCollage(local, spots)),
    [local, spots],
  );

  const collageItems: CollageItem[] = useMemo(() => {
    if (!local || !spots.length) return [];
    const done = spots
      .map((s) => {
        const ph = local.spots[s.id]?.photoDataUrl;
        if (!ph) return null;
        return { dataUrl: ph, name: s.name };
      })
      .filter(Boolean) as CollageItem[];
    return done;
  }, [local, spots]);

  if (!hydrated) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#0b1120] text-slate-200">
        載入中…
      </div>
    );
  }

  return (
    <div className="relative min-h-[100dvh] bg-[#0b1120] pb-28 text-slate-100">
      {showIntro && <IntroAnimation onDone={onIntroDone} />}

      {needsRealName && (
        <RegistrationModal
          hasUserCode={Boolean(local.userCode)}
          submitting={regSubmitting}
          onSubmit={submitRealName}
        />
      )}

      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0b1120]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg flex-col gap-3 px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium tracking-[0.2em] text-sky-300/90">
                Day 3 大地遊戲
              </p>
              <h1 className="text-xl font-bold text-white">2026 我們的騎跡</h1>
              {local.realName && (
                <p className="mt-1 text-sm text-slate-400">
                  你好，{local.realName}
                </p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-1 rounded-2xl bg-white/5 p-1">
            <button
              type="button"
              onClick={() => setTab("spots")}
              className={`rounded-xl py-2 text-xs font-semibold transition sm:text-sm ${
                tab === "spots"
                  ? "bg-sky-500 text-white shadow"
                  : "text-slate-400"
              }`}
            >
              任務
            </button>
            <button
              type="button"
              onClick={() => setTab("leaderboard")}
              className={`rounded-xl py-2 text-xs font-semibold transition sm:text-sm ${
                tab === "leaderboard"
                  ? "bg-amber-500 text-white shadow"
                  : "text-slate-400"
              }`}
            >
              排行榜
            </button>
            <button
              type="button"
              onClick={() => {
                if (!canCollage) {
                  showToast(
                    `請先完成至少 ${COLLAGE_MIN_GENERAL_SPOTS} 個一般景點拍照（終極／特級不計入）`,
                  );
                  return;
                }
                setTab("collage");
              }}
              className={`rounded-xl py-2 text-xs font-semibold transition sm:text-sm ${
                tab === "collage"
                  ? "bg-fuchsia-500 text-white shadow"
                  : canCollage
                    ? "text-slate-200"
                    : "text-slate-500"
              }`}
            >
              圖片拼貼
            </button>
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-xs text-slate-400">
              一般景點 {mainDone} / {mainTotal}（解鎖 圖片拼貼 需完成{" "}
              {COLLAGE_MIN_GENERAL_SPOTS} 個一般景點）
            </p>
            <a
              href="https://www.google.com/maps/d/u/1/edit?mid=1b07MI4Wb9N6Ea85DYOpfPGBv4eRl3rw&usp=sharing"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-sky-400/95 underline decoration-sky-500/40 underline-offset-2 hover:text-sky-300"
            >
              作弊小工具 · 地圖
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 pt-6">
        {tab === "spots" && (
          <ul className="flex flex-col gap-4">
            {spots.map((s) => {
              const done = local ? isSpotCompleted(local, s) : false;
              const isUltimate = Boolean(s.ultimate) || s.id === "ultimate-selfie";
              const isSpecial = Boolean(s.special);
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => setActive(s)}
                    disabled={needsRealName}
                    className={`group flex w-full overflow-hidden rounded-3xl border text-left shadow-lg transition active:scale-[0.99] disabled:opacity-40 ${
                      isUltimate
                        ? "border-amber-400/45 bg-gradient-to-br from-amber-950/35 via-violet-950/25 to-slate-950/50 ring-1 ring-amber-400/25"
                        : isSpecial
                          ? "border-cyan-400/40 bg-gradient-to-br from-cyan-950/30 to-slate-950/45 ring-1 ring-cyan-400/20"
                          : "border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.02]"
                    }`}
                  >
                    <div className="relative h-28 w-28 shrink-0 bg-black/30">
                      <Image
                        src={s.image}
                        alt=""
                        fill
                        unoptimized
                        className="object-cover"
                        sizes="112px"
                      />
                      {done && (
                        <span className="absolute right-1 top-1 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white">
                          已完成
                        </span>
                      )}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {isSpecial && (
                          <span className="shrink-0 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 px-2 py-0.5 text-[10px] font-bold text-white">
                            特級任務
                          </span>
                        )}
                        {isUltimate && (
                          <span className="shrink-0 rounded-full bg-gradient-to-r from-amber-500 to-fuchsia-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                            終極任務
                          </span>
                        )}
                        <h2 className="min-w-0 truncate text-base font-bold text-white">
                          {s.name}
                        </h2>
                        <span className="shrink-0 rounded-full bg-amber-500/20 px-2 py-0.5 text-[11px] font-semibold text-amber-200">
                          +{s.points} 分
                        </span>
                      </div>
                      <p className="line-clamp-2 text-xs leading-relaxed text-slate-400">
                        {s.description}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {tab === "leaderboard" && (
          <section className="rounded-3xl border border-amber-500/20 bg-gradient-to-b from-amber-950/30 to-slate-950/40 p-4">
            <h2 className="text-lg font-bold text-white">積分排行榜</h2>
            <p className="mt-1 text-xs text-slate-400">
              依總積分排序；同分則依最後打卡時間先後。時間為台北時間（UTC+8）。
            </p>
            {lbLoading && (
              <p className="mt-6 text-center text-sm text-slate-400">載入中…</p>
            )}
            {!lbLoading && leaderboard && leaderboard.length === 0 && (
              <p className="mt-6 text-center text-sm text-slate-400">
                尚無打卡紀錄
              </p>
            )}
            {!lbLoading && leaderboard && leaderboard.length > 0 && (
              <ul className="mt-4 flex flex-col gap-2">
                {leaderboard.map((row, i) => {
                  const isMe =
                    local.userCode && row.user_code === local.userCode;
                  return (
                    <li
                      key={row.user_code}
                      className={`flex items-center justify-between gap-3 rounded-2xl border px-3 py-3 text-sm ${
                        isMe
                          ? "border-amber-400/50 bg-amber-500/15"
                          : "border-white/10 bg-black/20"
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="w-8 shrink-0 text-center font-mono text-slate-500">
                          {i + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-white">
                            {row.real_name?.trim() || "（未填）"}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {row.checkin_count} · 最後{" "}
                            {formatTaipeiDisplay(row.last_checkin)}
                          </p>
                        </div>
                      </div>
                      <span className="shrink-0 font-mono text-amber-200">
                        {row.total_points}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}

        {tab === "collage" && canCollage && (
          <section className="rounded-3xl border border-fuchsia-500/20 bg-gradient-to-b from-fuchsia-950/40 to-slate-950/40 p-5">
            <CollageCanvas items={collageItems} />
          </section>
        )}
      </main>

      {toast && (
        <div className="fixed bottom-24 left-1/2 z-40 max-w-[90vw] -translate-x-1/2 rounded-full border border-white/15 bg-slate-900/95 px-4 py-2 text-center text-xs text-slate-100 shadow-xl">
          {toast}
        </div>
      )}

      {active && !needsRealName && (
        <SpotSheet
          key={active.id}
          spot={active}
          progress={local.spots[active.id]}
          userCode={local.userCode}
          showToast={showToast}
          onClose={() => setActive(null)}
          onUpdate={async (patch) =>
            mergeLocal((st) => ({
              ...st,
              spots: {
                ...st.spots,
                [active.id]: {
                  introRead: patch.introRead ?? st.spots[active.id]?.introRead ?? false,
                  photoDataUrl: patch.photoDataUrl ?? st.spots[active.id]?.photoDataUrl,
                  photoInIdb: patch.photoInIdb ?? st.spots[active.id]?.photoInIdb,
                  completedAt: patch.completedAt ?? st.spots[active.id]?.completedAt,
                  reflectionText:
                    patch.reflectionText ?? st.spots[active.id]?.reflectionText,
                },
              },
            }))
          }
          onSynced={() => showToast("已同步積分與打卡時間")}
        />
      )}
    </div>
  );
}

function RegistrationModal({
  hasUserCode,
  submitting,
  onSubmit,
}: {
  hasUserCode: boolean;
  submitting: boolean;
  onSubmit: (name: string) => void | Promise<void>;
}) {
  const [name, setName] = useState("");
  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-[#050814]/95 px-6 backdrop-blur-md">
      <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#0f172a] p-6 shadow-2xl">
        <p className="text-center text-xs font-medium tracking-[0.25em] text-sky-300/90">
          2026 我們的騎跡
        </p>
        <h2 className="mt-3 text-center text-lg font-bold text-white">
          {hasUserCode ? "請補登真實姓名" : "請填寫真實姓名"}
        </h2>
        <p className="mt-2 text-center text-xs leading-relaxed text-slate-400">
          2～3 個字中文姓名
        </p>
        <input
          type="text"
          autoComplete="name"
          inputMode="text"
          maxLength={3}
          value={name}
          onChange={(e) => setName(e.target.value.replace(/\s/g, ""))}
          placeholder="例：曾禪藍"
          className="mt-5 w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-base text-white outline-none ring-sky-500/40 placeholder:text-slate-500 focus:ring-2"
        />
        <button
          type="button"
          disabled={submitting}
          onClick={() => onSubmit(name)}
          className="mt-4 w-full rounded-2xl bg-gradient-to-r from-sky-500 to-cyan-500 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/25 disabled:opacity-50"
        >
          {submitting ? "送出中…" : "確認並開始"}
        </button>
      </div>
    </div>
  );
}

type SheetProps = {
  spot: Spot;
  progress?: {
    introRead?: boolean;
    photoDataUrl?: string;
    photoInIdb?: boolean;
    completedAt?: string;
    reflectionText?: string;
  };
  userCode: string | null;
  showToast: (msg: string) => void;
  onClose: () => void;
  onUpdate: (p: {
    introRead?: boolean;
    photoDataUrl?: string;
    photoInIdb?: boolean;
    completedAt?: string;
    reflectionText?: string;
  }) => boolean | Promise<boolean>;
  onSynced: () => void;
};

type StoryPhase = "typing" | "awaitTap" | "task";

function getInitialStoryPhase(
  spot: Spot,
  progress: SheetProps["progress"],
): StoryPhase {
  const isReflect = Boolean(spot.special && spot.reflectionMinChars);
  const minC = spot.reflectionMinChars ?? 200;
  if (isReflect) {
    const done =
      countReflectionCharsExcludingPunctuation(progress?.reflectionText ?? "") >=
      minC;
    if (done) return "task";
    return progress?.introRead ? "task" : "typing";
  }
  if (progress?.photoDataUrl || progress?.photoInIdb) return "task";
  return progress?.introRead ? "task" : "typing";
}

function SpotSheet({
  spot,
  progress,
  userCode,
  showToast,
  onClose,
  onUpdate,
  onSynced,
}: SheetProps) {
  const isReflect = Boolean(spot.special && spot.reflectionMinChars);
  const minReflection = spot.reflectionMinChars ?? 200;

  const [phase, setPhase] = useState<StoryPhase>(() =>
    getInitialStoryPhase(spot, progress),
  );
  const [shownLen, setShownLen] = useState(0);
  const [sessionRead, setSessionRead] = useState(false);
  const [draft, setDraft] = useState(progress?.reflectionText ?? "");
  const fileRef = useRef<HTMLInputElement>(null);

  const readConfirmed =
    Boolean(progress?.introRead) || sessionRead || phase === "task";
  const canPhoto = readConfirmed;

  const text = spot.description;
  const draftCount = countReflectionCharsExcludingPunctuation(draft);
  const reflectionSubmitted =
    isReflect &&
    countReflectionCharsExcludingPunctuation(progress?.reflectionText ?? "") >=
      minReflection;

  useEffect(() => {
    if (phase !== "typing") return;
    if (shownLen >= text.length) {
      const id = window.requestAnimationFrame(() => setPhase("awaitTap"));
      return () => window.cancelAnimationFrame(id);
    }
    const t = window.setTimeout(() => setShownLen((n) => n + 1), 22);
    return () => clearTimeout(t);
  }, [phase, shownLen, text.length]);

  const goTask = () => {
    setSessionRead(true);
    setPhase("task");
    void Promise.resolve(onUpdate({ introRead: true }));
  };

  const onStoryPanelPointer = () => {
    if (phase === "awaitTap") goTask();
  };

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f || !canPhoto) return;
    try {
      const dataUrl = await fileToCompressedDataUrl(f);
      const completedAt = nowTaipeiSqlite();
      const idbOk = await putPhoto(spot.id, dataUrl);
      if (!idbOk) {
        showToast(
          "無法寫入瀏覽器相片快取（IndexedDB）。請檢查儲存空間或關閉私密瀏覽後重試。",
        );
        return;
      }
      const saved = await Promise.resolve(
        onUpdate({
          photoDataUrl: dataUrl,
          photoInIdb: true,
          completedAt,
          introRead: true,
        }),
      );
      if (!saved) {
        await deletePhoto(spot.id);
        return;
      }
      if (userCode) {
        const r = await fetch("/api/checkin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userCode,
            spotId: spot.id,
            points: spot.points,
          }),
        });
        if (r.ok) onSynced();
      }
    } catch {
      /* ignore */
    }
    e.target.value = "";
  };

  const submitReflection = async () => {
    if (!isReflect || draftCount < minReflection) return;
    const completedAt = nowTaipeiSqlite();
    const saved = await Promise.resolve(
      onUpdate({
        reflectionText: draft,
        completedAt,
        introRead: true,
      }),
    );
    if (!saved) return;
    if (userCode) {
      const r = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userCode,
          spotId: spot.id,
          points: spot.points,
          reflectionText: draft,
        }),
      });
      if (r.ok) onSynced();
    }
  };

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-[#050814]">
      <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
        <h3 className="text-lg font-bold text-white">{spot.name}</h3>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full bg-white/10 px-3 py-1 text-sm text-slate-200"
        >
          關閉
        </button>
      </div>

      <div className="relative h-[28dvh] min-h-[140px] w-full shrink-0 bg-black/50">
        <Image
          src={spot.image}
          alt=""
          fill
          unoptimized
          className="object-cover"
          sizes="100vw"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#050814] via-transparent to-transparent" />
      </div>

      {phase !== "task" && (
        <button
          type="button"
          className="flex min-h-0 flex-1 flex-col px-5 pb-10 pt-6 text-left"
          onClick={onStoryPanelPointer}
        >
          <p className="text-xs font-medium text-sky-300/90">
            劇情模式 · 介紹播完後，點擊空白處開始任務
          </p>
          <p className="mt-4 min-h-[8rem] text-[15px] leading-[1.75] text-slate-100 sm:text-base">
            {text.slice(0, shownLen)}
            {phase === "typing" && (
              <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-sky-400 align-middle" />
            )}
          </p>
          {phase === "awaitTap" && (
            <p className="mt-auto pt-8 text-center text-sm font-medium text-sky-300/95 animate-pulse">
              點擊空白處開始任務
            </p>
          )}
        </button>
      )}

      {phase === "task" && isReflect && (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-10 pt-4">
          <p className="text-xs leading-relaxed text-slate-400">
            任務：撰寫至少 {minReflection}{" "}
            字心得，字數以「不含標點符號」計算（空白不計）。
          </p>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            readOnly={reflectionSubmitted}
            rows={12}
            className="mt-3 min-h-[12rem] w-full resize-y rounded-2xl border border-white/15 bg-black/35 px-4 py-3 text-[15px] leading-relaxed text-slate-100 outline-none ring-cyan-500/30 placeholder:text-slate-600 focus:ring-2 read-only:opacity-90"
            placeholder="在此輸入今日這個大地方的心得…"
          />
          <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
            <span>
              有效字數：<span className="font-mono text-cyan-300">{draftCount}</span> /{" "}
              {minReflection}
            </span>
            {reflectionSubmitted && (
              <span className="text-emerald-400">已提交</span>
            )}
          </div>
          {!reflectionSubmitted && (
            <button
              type="button"
              disabled={draftCount < minReflection}
              onClick={submitReflection}
              className="mt-4 w-full rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              提交心得並取得積分
            </button>
          )}
          {reflectionSubmitted && (
            <p className="mt-4 text-center text-sm text-emerald-300">
              特級任務已完成 · 積分 {spot.points}
            </p>
          )}
        </div>
      )}

      {phase === "task" && !isReflect && (
        <div className="flex flex-1 flex-col px-5 pb-10 pt-4">
          <p className="text-xs text-slate-500">任務：在此景點拍照打卡</p>
          <div className="mt-4 flex flex-1 flex-col gap-3">
            {!progress?.photoDataUrl && !progress?.photoInIdb ? (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={onPick}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25"
                >
                  拍照／選照片完成任務
                </button>
              </>
            ) : (
              <div className="space-y-2">
                <p className="text-center text-xs text-emerald-300">
                  此景點已完成 · 積分 {spot.points}
                </p>
                {progress?.photoDataUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={progress.photoDataUrl}
                    alt="任務照片"
                    className="max-h-[42dvh] w-full rounded-2xl object-contain"
                  />
                ) : (
                  <p className="py-8 text-center text-sm text-slate-400">照片載入中…</p>
                )}
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="w-full rounded-2xl border border-white/15 bg-white/5 py-2 text-xs text-slate-200"
                >
                  重拍一張
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={onPick}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
