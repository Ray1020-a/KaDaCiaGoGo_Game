"use client";

type Props = {
  onDone: () => void;
};

export function IntroAnimation({ onDone }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-y-auto overflow-x-hidden bg-[#050814] px-5 py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(56,189,248,0.22),transparent),radial-gradient(ellipse_90%_60%_at_100%_100%,rgba(251,146,60,0.12),transparent),radial-gradient(ellipse_80%_50%_at_0%_80%,rgba(139,92,246,0.1),transparent)]" />

      <div className="relative z-10 flex w-full max-w-md flex-col items-center gap-10">
        <div className="intro-text-card w-full rounded-[1.75rem] border border-white/20 bg-gradient-to-b from-slate-900/90 to-slate-950/95 px-7 py-9 shadow-[0_24px_64px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl">
          <p className="text-center text-[13px] font-semibold tracking-[0.32em] text-sky-300 sm:text-sm">
            Day 3 大地遊戲
          </p>
          <h1 className="mt-5 text-center text-[clamp(1.875rem,6vw,2.5rem)] font-bold leading-[1.25] tracking-tight text-white [text-shadow:0_2px_24px_rgba(0,0,0,0.65),0_0_1px_rgba(255,255,255,0.15)]">
            2026 我們的騎跡
          </h1>
        </div>

        <div className="relative flex h-36 w-36 shrink-0 items-center justify-center sm:h-40 sm:w-40">
          <div className="animate-game-ring pointer-events-none absolute inset-0 rounded-full border border-sky-400/20 bg-sky-500/5" />
          <div className="animate-game-bike flex h-full w-full items-center justify-center text-7xl sm:text-8xl">
            <span className="drop-shadow-[0_12px_32px_rgba(56,189,248,0.55)] filter">
              🚴
            </span>
          </div>
          <div className="animate-game-road pointer-events-none absolute -bottom-6 left-1/2 h-2 w-36 -translate-x-1/2 rounded-full bg-gradient-to-r from-transparent via-white/30 to-transparent blur-[2px]" />
        </div>

        <button
          type="button"
          onClick={onDone}
          className="w-full max-w-xs rounded-2xl bg-gradient-to-r from-sky-400 via-cyan-400 to-sky-400 py-4 text-base font-bold text-slate-950 shadow-[0_12px_40px_rgba(34,211,238,0.35)] transition active:scale-[0.98]"
        >
          開始任務
        </button>
      </div>
    </div>
  );
}
