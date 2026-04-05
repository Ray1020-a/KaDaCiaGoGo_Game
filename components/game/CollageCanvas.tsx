"use client";

import { useCallback, useRef, useState } from "react";

const W = 1080;
const H = 1920;

/** 拼貼內容區起點（標語與標題畫在上方，需與 drawHeaderAndSlogan 底部留白一致） */
const PHOTO_START_Y = 420;

type FrameSpec = {
  x: number;
  y: number;
  w: number;
  h: number;
  rot: number;
};

function computeFrames(n: number, Wc: number, Hc: number, startY: number): FrameSpec[] {
  const margin = 32;
  const gap = 14;
  const bottomPad = 24;
  const availH = Hc - startY - bottomPad;
  const maxW = Wc - margin * 2;
  if (n <= 0) return [];
  let cols = 1;
  if (n === 1) cols = 1;
  else if (n === 2) cols = 2;
  else if (n <= 4) cols = 2;
  else cols = 3;
  const rows = Math.ceil(n / cols);
  const cellW = (maxW - gap * (cols - 1)) / cols;
  const cellH = (availH - gap * (rows - 1)) / rows;
  const frames: FrameSpec[] = [];
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const cx = margin + col * (cellW + gap) + cellW / 2;
    const cy = startY + row * (cellH + gap) + cellH / 2;
    let fh = Math.min(cellH * 0.72, (cellW * 0.95) / 0.92);
    let fw = fh * 0.92;
    if (fw > cellW * 0.95) {
      fw = cellW * 0.95;
      fh = fw / 0.92;
    }
    const rot = ((i % 5) - 2) * 0.035;
    frames.push({ x: cx - fw / 2, y: cy - fh / 2, w: fw, h: fh, rot });
  }
  return frames;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const ir = img.width / img.height;
  const r = w / h;
  let sx = 0;
  let sy = 0;
  let sw = img.width;
  let sh = img.height;
  if (ir > r) {
    sw = img.height * r;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / r;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

async function ensureCollageFonts() {
  if (typeof document === "undefined" || !document.fonts) return;
  try {
    await document.fonts.ready;
    await document.fonts.load('700 44px "Noto Sans TC"');
    await document.fonts.load('700 40px "Noto Sans TC"');
    await document.fonts.load('700 56px Orbitron');
    await document.fonts.load('600 24px Orbitron');
    await document.fonts.load('400 23px "Noto Sans TC"');
  } catch {
    /* ignore */
  }
}

const NOTO = '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif';

function drawTextLine(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
  font: string,
  fillStyle: string,
  shadow?: { blur: number; color: string },
) {
  ctx.font = font;
  ctx.fillStyle = fillStyle;
  if (shadow) {
    ctx.shadowColor = shadow.color;
    ctx.shadowBlur = shadow.blur;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  } else {
    ctx.shadowBlur = 0;
    ctx.shadowColor = "transparent";
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, cx, cy);
}

function drawHeaderAndSlogan(ctx: CanvasRenderingContext2D) {
  const cx = W / 2;
  const bandH = 410;
  const bandGrad = ctx.createLinearGradient(0, 0, 0, bandH);
  bandGrad.addColorStop(0, "rgba(15,23,42,0.98)");
  bandGrad.addColorStop(0.45, "rgba(30,58,95,0.9)");
  bandGrad.addColorStop(1, "rgba(15,23,42,0)");
  ctx.fillStyle = bandGrad;
  ctx.fillRect(0, 0, W, bandH);

  /** 以行中心 Y 排版（textBaseline: middle），避免混用字體時基線不齊 */
  let y = 74;
  drawTextLine(
    ctx,
    "今天的我！特別努力",
    cx,
    y,
    `700 44px ${NOTO}`,
    "#fffbeb",
    { blur: 18, color: "rgba(251, 146, 60, 0.35)" },
  );
  y += 58;
  drawTextLine(
    ctx,
    "我們的騎行，繼續前進",
    cx,
    y,
    `700 40px ${NOTO}`,
    "#f8fafc",
    { blur: 14, color: "rgba(251, 146, 60, 0.22)" },
  );
  y += 52;
  drawTextLine(
    ctx,
    "#2026我們的騎跡",
    cx,
    y,
    "600 23px Orbitron, sans-serif",
    "#fde68a",
  );
  y += 62;
  drawTextLine(
    ctx,
    "2026",
    cx,
    y,
    "700 56px Orbitron, sans-serif",
    "#ffffff",
    { blur: 12, color: "rgba(0,0,0,0.35)" },
  );
  y += 58;
  drawTextLine(
    ctx,
    "我們的騎跡",
    cx,
    y,
    `700 38px ${NOTO}`,
    "rgba(255,255,255,0.98)",
  );
  y += 52;
  drawTextLine(
    ctx,
    "Day 3 · 大地遊戲 · 打卡回憶拼貼",
    cx,
    y,
    `400 22px ${NOTO}`,
    "rgba(226,232,240,0.9)",
  );

  ctx.shadowBlur = 0;
  const lineY = y + 36;
  ctx.strokeStyle = "rgba(255,255,255,0.2)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(64, lineY);
  ctx.lineTo(W - 64, lineY);
  ctx.stroke();

  ctx.textBaseline = "alphabetic";
}

export type CollageItem = {
  dataUrl: string;
  name: string;
};

type Props = {
  items: CollageItem[];
  onRendered?: () => void;
};

export function CollageCanvas({ items, onRendered }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const render = useCallback(async () => {
    const canvas = ref.current;
    if (!canvas || items.length === 0) return;
    setBusy(true);
    try {
      await ensureCollageFonts();
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, "#0f172a");
      g.addColorStop(0.35, "#1e3a5f");
      g.addColorStop(0.65, "#0c4a6e");
      g.addColorStop(1, "#312e81");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      ctx.save();
      ctx.globalAlpha = 0.12;
      for (let i = 0; i < 40; i++) {
        ctx.beginPath();
        ctx.arc(
          (Math.sin(i * 1.7) * 0.5 + 0.5) * W,
          (Math.cos(i * 1.3) * 0.5 + 0.5) * H,
          40 + (i % 5) * 18,
          0,
          Math.PI * 2,
        );
        ctx.fillStyle = i % 2 === 0 ? "#38bdf8" : "#fb923c";
        ctx.fill();
      }
      ctx.restore();

      drawHeaderAndSlogan(ctx);

      const frames = computeFrames(items.length, W, H, PHOTO_START_Y);
      const imgs = await Promise.all(items.map((i) => loadImage(i.dataUrl)));

      for (let i = 0; i < imgs.length; i++) {
        const f = frames[i];
        if (!f) break;
        const img = imgs[i];
        ctx.save();
        ctx.translate(f.x + f.w / 2, f.y + f.h / 2);
        ctx.rotate(f.rot);
        ctx.shadowColor = "rgba(0,0,0,0.45)";
        ctx.shadowBlur = 40;
        ctx.fillStyle = "#fafafa";
        ctx.fillRect(-f.w / 2 - 18, -f.h / 2 - 18, f.w + 36, f.h + 56);
        ctx.shadowBlur = 0;
        drawCover(ctx, img, -f.w / 2, -f.h / 2, f.w, f.h);
        const cap = Math.min(26, Math.max(18, f.w * 0.055));
        ctx.fillStyle = "#334155";
        ctx.font = `${cap}px "Noto Sans TC", system-ui, sans-serif`;
        ctx.textAlign = "center";
        const label = items[i].name;
        ctx.fillText(label, 0, f.h / 2 + cap + 4);
        ctx.restore();
      }

      const url = canvas.toDataURL("image/png");
      setPreviewUrl(url);
      onRendered?.();
    } finally {
      setBusy(false);
    }
  }, [items, onRendered]);

  const download = () => {
    if (!previewUrl) return;
    const a = document.createElement("a");
    a.href = previewUrl;
    a.download = `kadaciagogo-ig-${Date.now()}.png`;
    a.click();
  };

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <canvas
        ref={ref}
        className="hidden"
        width={W}
        height={H}
        aria-hidden
      />
      <button
        type="button"
        disabled={busy || items.length < 1}
        onClick={render}
        className="w-full rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-500/30 disabled:opacity-40"
      >
        {busy ? "產生拼貼中…" : "產生限動圖（9:16）"}
      </button>
      {previewUrl && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="限動預覽"
            className="max-h-[55vh] w-auto max-w-full rounded-xl border border-white/15 shadow-2xl"
          />
          <button
            type="button"
            onClick={download}
            className="w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white"
          >
            下載 PNG
          </button>
        </>
      )}
    </div>
  );
}
