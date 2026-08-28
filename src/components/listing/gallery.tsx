"use client";

import * as React from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Expand, X, ZoomIn, ZoomOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type GalleryImage = {
  url: string;
  thumbUrl: string;
  blurDataURL: string | null;
  width: number;
  height: number;
};

/**
 * גלריית תמונות עם lightbox, זום וניווט מקלדת מלא
 * (חצים למעבר, +/- לזום, Escape לסגירה).
 */
export function Gallery({
  images,
  title,
  transitionName,
}: {
  images: GalleryImage[];
  title: string;
  /** שם המעבר מהכרטיס — ראה `src/lib/view-transitions.ts` */
  transitionName?: string;
}) {
  const [index, setIndex] = React.useState(0);
  const [open, setOpen] = React.useState(false);
  const thumbsRef = React.useRef<HTMLDivElement>(null);

  const count = images.length;
  const current = images[index];

  const go = React.useCallback(
    (delta: number) => {
      if (!count) return;
      setIndex((i) => (i + delta + count) % count);
    },
    [count],
  );

  // ניווט בחצים גם כשה-lightbox סגור, כל עוד הפוקוס לא בשדה קלט
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      // ב-RTL חץ ימינה מקדם לתמונה הקודמת
      if (e.key === "ArrowRight") go(-1);
      else if (e.key === "ArrowLeft") go(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  // גלילת רצועת התמונות הקטנות כך שהנבחרת תמיד נראית
  React.useEffect(() => {
    const strip = thumbsRef.current;
    const active = strip?.querySelector<HTMLElement>(`[data-index="${index}"]`);
    active?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [index]);

  if (!count || !current) {
    return (
      <div className="grid aspect-[4/3] w-full place-items-center rounded-lg border border-dashed border-border bg-muted text-muted-foreground">
        אין תמונות למודעה זו
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div
        className="group relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-muted sm:aspect-[16/10]"
        // המעבר חל על התמונה הראשית בלבד; החלפת תמונה בגלריה אינה ניווט
        style={transitionName ? { viewTransitionName: transitionName } : undefined}
      >
        <Image
          src={current.url}
          alt={`${title} — תמונה ${index + 1} מתוך ${count}`}
          fill
          sizes="(max-width: 1024px) 100vw, 800px"
          className="object-contain"
          placeholder={current.blurDataURL ? "blur" : "empty"}
          blurDataURL={current.blurDataURL ?? undefined}
          priority
        />

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="absolute inset-0 z-10 cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          <span className="sr-only">הגדלת התמונה למסך מלא</span>
        </button>

        {/*
          * המונה למעלה וכפתור ההגדלה למטה — פינות שונות בציר האנכי ולא
          * רק בציר האופקי. שתי פינות תחתונות נפגשו בפועל כשכיוון הטקסט
          * לא נפתר כמצופה, והמונה הוסתר מאחורי הכפתור.
          */}
        <span className="num pointer-events-none absolute start-3 top-3 z-20 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white">
          {index + 1} / {count}
        </span>

        <Button
          variant="secondary"
          size="icon-sm"
          className="absolute bottom-3 end-3 z-20"
          onClick={() => setOpen(true)}
          aria-label="מסך מלא"
        >
          <Expand aria-hidden />
        </Button>

        {count > 1 ? (
          <>
            <NavButton side="start" onClick={() => go(-1)} label="התמונה הקודמת" />
            <NavButton side="end" onClick={() => go(1)} label="התמונה הבאה" />
          </>
        ) : null}
      </div>

      {count > 1 ? (
        <div
          ref={thumbsRef}
          className="flex gap-2 overflow-x-auto pb-1 no-scrollbar"
          role="tablist"
          aria-label="תמונות המודעה"
        >
          {images.map((img, i) => (
            <button
              key={img.url}
              type="button"
              data-index={i}
              role="tab"
              aria-selected={i === index}
              aria-label={`תמונה ${i + 1}`}
              onClick={() => setIndex(i)}
              className={cn(
                "relative aspect-[4/3] w-20 shrink-0 overflow-hidden rounded-md border-2 transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                i === index ? "border-primary" : "border-transparent opacity-70 hover:opacity-100",
              )}
            >
              <Image
                src={img.thumbUrl}
                alt=""
                fill
                sizes="80px"
                className="object-cover"
                placeholder={img.blurDataURL ? "blur" : "empty"}
                blurDataURL={img.blurDataURL ?? undefined}
              />
            </button>
          ))}
        </div>
      ) : null}

      <Lightbox
        images={images}
        index={index}
        title={title}
        open={open}
        onOpenChange={setOpen}
        onNavigate={go}
      />
    </div>
  );
}

function NavButton({
  side,
  onClick,
  label,
}: {
  side: "start" | "end";
  onClick: () => void;
  label: string;
}) {
  // ב-RTL הצד ההתחלתי הוא ימין, ולכן החץ שם מצביע ימינה
  const Icon = side === "start" ? ChevronRight : ChevronLeft;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "absolute top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-background/85 backdrop-blur transition-opacity",
        "hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "opacity-0 group-hover:opacity-100 focus-visible:opacity-100 sm:opacity-70",
        side === "start" ? "start-3" : "end-3",
      )}
    >
      <Icon className="size-5" aria-hidden />
    </button>
  );
}

function Lightbox({
  images,
  index,
  title,
  open,
  onOpenChange,
  onNavigate,
}: {
  images: GalleryImage[];
  index: number;
  title: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onNavigate: (delta: number) => void;
}) {
  const [zoom, setZoom] = React.useState(1);
  const image = images[index];

  React.useEffect(() => setZoom(1), [index, open]);

  React.useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "+" || e.key === "=") setZoom((z) => Math.min(4, z + 0.5));
      if (e.key === "-") setZoom((z) => Math.max(1, z - 0.5));
      if (e.key === "0") setZoom(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!image) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideClose
        className="max-w-none border-0 bg-black/95 p-0 sm:rounded-none"
        style={{ width: "100vw", height: "100dvh", maxHeight: "100dvh", insetInlineStart: "50%" }}
      >
        <DialogTitle className="sr-only">{title} — תצוגת מסך מלא</DialogTitle>

        <div className="relative flex h-full flex-col">
          <div className="flex items-center justify-between gap-2 p-3 text-white">
            <span className="num text-sm">
              {index + 1} / {images.length}
            </span>
            <div className="flex items-center gap-1">
              <IconBtn onClick={() => setZoom((z) => Math.max(1, z - 0.5))} label="התרחקות">
                <ZoomOut aria-hidden />
              </IconBtn>
              <span className="num min-w-12 text-center text-sm">
                {Math.round(zoom * 100)}%
              </span>
              <IconBtn onClick={() => setZoom((z) => Math.min(4, z + 0.5))} label="התקרבות">
                <ZoomIn aria-hidden />
              </IconBtn>
              <IconBtn onClick={() => onOpenChange(false)} label="סגירה">
                <X aria-hidden />
              </IconBtn>
            </div>
          </div>

          <div className="relative flex-1 overflow-auto">
            <div
              className="relative mx-auto h-full w-full transition-transform duration-150"
              style={{ transform: `scale(${zoom})` }}
            >
              <Image
                src={image.url}
                alt={`${title} — תמונה ${index + 1}`}
                fill
                sizes="100vw"
                className="object-contain"
                placeholder={image.blurDataURL ? "blur" : "empty"}
                blurDataURL={image.blurDataURL ?? undefined}
              />
            </div>
          </div>

          {images.length > 1 ? (
            <div className="flex items-center justify-center gap-4 p-3">
              <IconBtn onClick={() => onNavigate(-1)} label="הקודם">
                <ChevronRight aria-hidden />
              </IconBtn>
              <IconBtn onClick={() => onNavigate(1)} label="הבא">
                <ChevronLeft aria-hidden />
              </IconBtn>
            </div>
          ) : null}

          <p className="pb-3 text-center text-xs text-white/60">
            ניווט בחצים · זום ב־+ ו־− · יציאה ב־Esc
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function IconBtn({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid size-10 place-items-center rounded-full text-white transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
    >
      {children}
    </button>
  );
}
