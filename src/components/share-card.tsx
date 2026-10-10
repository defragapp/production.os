"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Share2, Download, X } from "lucide-react";
import { EMBLEM_DATA_URI } from "@/lib/brand-emblem-data";
import { openingPassage } from "@/lib/share-card";
import { Button } from "@/components/ui/button";

/**
 * "What Sovereign saw" — an ownable artifact for any assistant turn. The card
 * is drawn entirely on a client-side canvas: no summarization call, no DB
 * write, no server cost. The person takes a piece of the conversation with
 * them and shares it as their own insight.
 */

const SIZE = 1080;
const SERIF = 'Georgia, "Times New Roman", serif';
const SANS = '"Helvetica Neue", Arial, sans-serif';

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
      if (lines.length === maxLines - 1) break;
    } else {
      line = test;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);
  // If we stopped early, there is more text — ellipsize the last shown line.
  const consumed = lines.join(" ").length;
  if (consumed < text.trim().length && lines.length) {
    lines[lines.length - 1] = `${lines[lines.length - 1].replace(/[.,;:]+\s*$/, "")}…`;
  }
  return lines;
}

function trackedWidth(ctx: CanvasRenderingContext2D, text: string, spacing: number): number {
  let w = 0;
  for (const ch of text) w += ctx.measureText(ch).width + spacing;
  return w - spacing;
}

function drawTracked(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, spacing: number) {
  const prev = ctx.textAlign;
  ctx.textAlign = "left";
  let x = cx - trackedWidth(ctx, text, spacing) / 2;
  for (const ch of text) {
    ctx.fillText(ch, x, y);
    x += ctx.measureText(ch).width + spacing;
  }
  ctx.textAlign = prev;
}

async function renderCard(quote: string): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");

  // Warm near-black ground with a soft top glow, like the app.
  const bg = ctx.createRadialGradient(SIZE / 2, SIZE * 0.3, 40, SIZE / 2, SIZE * 0.55, SIZE * 0.8);
  bg.addColorStop(0, "#191610");
  bg.addColorStop(1, "#0c0b09");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Orbit motif — faint concentric rings with a single travelling point.
  const cy = SIZE * 0.44;
  ctx.lineWidth = 1.5;
  for (const r of [250, 330, 410]) {
    ctx.strokeStyle = `rgba(250,245,236,${0.05 - (r - 250) / 9000})`;
    ctx.beginPath();
    ctx.arc(SIZE / 2, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  const angle = -0.7;
  ctx.fillStyle = "rgba(250,245,236,0.55)";
  ctx.beginPath();
  ctx.arc(SIZE / 2 + 330 * Math.cos(angle), cy + 330 * Math.sin(angle), 6, 0, Math.PI * 2);
  ctx.fill();

  // Emblem, seated in a hairline ring.
  try {
    const emblem = new Image();
    emblem.src = EMBLEM_DATA_URI;
    await emblem.decode();
    const ew = 92;
    const eh = (emblem.height / emblem.width) * ew;
    ctx.strokeStyle = "rgba(250,245,236,0.12)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(SIZE / 2, 150 + eh / 2, 74, 0, Math.PI * 2);
    ctx.stroke();
    ctx.drawImage(emblem, SIZE / 2 - ew / 2, 150, ew, eh);
  } catch {
    /* emblem is decorative — the card still reads without it */
  }

  // Eyebrow.
  ctx.fillStyle = "rgba(184,177,163,0.92)";
  ctx.font = `600 24px ${SANS}`;
  drawTracked(ctx, "WHAT SOVEREIGN SAW", SIZE / 2, 320, 5);

  // The pull-quote — the reason the card exists. It is pinned to the band
  // between the eyebrow and the footer (never the orbit centre), so a long
  // passage can't climb back up into the emblem or overlap the eyebrow.
  ctx.fillStyle = "#faf5ec";
  ctx.font = `400 54px ${SERIF}`;
  ctx.textAlign = "left";
  const lines = wrapLines(ctx, quote, 800, 6);
  const lineHeight = 76;
  const bandTop = 396;
  const bandBottom = 884;
  const startY = bandTop + Math.max(0, (bandBottom - bandTop - lines.length * lineHeight) / 2) + 50;
  const left = (SIZE - measureBlock(ctx, lines)) / 2;
  lines.forEach((ln, i) => ctx.fillText(ln, left, startY + i * lineHeight));

  // Footer promise + domain.
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(194,188,176,0.9)";
  ctx.font = `400 30px ${SERIF}`;
  ctx.fillText("Turn conversation into self-knowledge you own", SIZE / 2, SIZE - 150);
  ctx.fillStyle = "rgba(150,144,132,0.85)";
  ctx.font = `600 24px ${SANS}`;
  drawTracked(ctx, "SOVEREIGN.DEFRAG.APP", SIZE / 2, SIZE - 96, 4);

  return canvas.toDataURL("image/png");
}

function measureBlock(ctx: CanvasRenderingContext2D, lines: string[]): number {
  let w = 0;
  for (const ln of lines) w = Math.max(w, ctx.measureText(ln).width);
  return w;
}

export function ShareCardButton({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // The dialog is portalled to <body>, so it owns keyboard behaviour here:
  // Escape closes, focus moves in on open and back to the trigger on close.
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const trigger = triggerRef.current;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      trigger?.focus();
    };
  }, [open]);

  const build = useCallback(async () => {
    const selection = window.getSelection()?.toString().trim();
    const quote = selection && selection.length >= 12 && selection.length <= 400 ? selection : openingPassage(text);
    if (!quote) return;
    setBusy(true);
    setNote(null);
    try {
      setDataUrl(await renderCard(quote));
    } catch {
      setNote("Couldn't draw the card on this device.");
    } finally {
      setBusy(false);
    }
  }, [text]);

  const start = useCallback(async () => {
    setOpen(true);
    await build();
  }, [build]);

  const share = useCallback(async () => {
    if (!dataUrl) return;
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], "sovereign-insight.png", { type: "image/png" });
      if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "What Sovereign saw", text: "Turn conversation into self-knowledge you own." });
        return;
      }
      download(dataUrl);
    } catch (e) {
      // A dismissed share sheet is not an error; anything else falls back to a file.
      if ((e as Error)?.name !== "AbortError") download(dataUrl);
    }
  }, [dataUrl]);

  const download = (url: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = "sovereign-insight.png";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setNote("Saved as an image — share it anywhere.");
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => void start()}
        aria-label="Create a share card from this insight"
        title="What Sovereign saw"
        className="tap-line inline-flex items-center gap-1.5 rounded-full border border-transparent px-2.5 py-1 text-xs text-muted-foreground/70 transition-colors hover:border-border/60 hover:bg-surface-hover hover:text-foreground"
      >
        <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
        Share
      </button>

      {open && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label="What Sovereign saw — share card"
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="glass-panel flex w-full max-w-md flex-col items-center gap-4 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex w-full items-center justify-between">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground/70">What Sovereign saw</p>
              <button ref={closeRef} type="button" onClick={() => setOpen(false)} aria-label="Close" className="rounded-chip p-1.5 text-muted-foreground hover:bg-surface-hover hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex w-full items-center justify-center rounded-panel border border-white/10 bg-black/30 p-3">
              {busy || !dataUrl ? (
                <div className="flex aspect-square w-full max-w-[320px] items-center justify-center text-sm text-muted-foreground">
                  {busy ? "Drawing…" : note || "Nothing to draw yet."}
                </div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={dataUrl} alt="Shareable card of this insight" className="aspect-square w-full max-w-[320px] rounded-control" />
              )}
            </div>

            {note && !busy && <p className="text-center text-xs text-muted-foreground">{note}</p>}

            <div className="flex w-full items-center justify-center gap-2">
              <Button onClick={() => void share()} disabled={!dataUrl} size="sm">
                <Share2 className="h-4 w-4" /> Share
              </Button>
              <Button variant="outline" size="sm" onClick={() => dataUrl && download(dataUrl)} disabled={!dataUrl}>
                <Download className="h-4 w-4" /> Save image
              </Button>
              <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => void build()} disabled={busy}>
                Redraw
              </Button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
