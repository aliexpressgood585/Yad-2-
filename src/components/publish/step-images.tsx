"use client";

import * as React from "react";
import Image from "next/image";
import { GripVertical, ImagePlus, Loader2, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { MAX_IMAGES } from "@/lib/site";
import { cn } from "@/lib/utils";

export type DraftImage = {
  url: string;
  thumbUrl?: string;
  blurhash?: string;
  width?: number;
  height?: number;
  phash?: string;
};

const MAX_CLIENT_DIMENSION = 2000;
const CLIENT_QUALITY = 0.85;

/**
 * שלב 3: תמונות. גרירה לשינוי סדר, דחיסה בצד לקוח לפני ההעלאה
 * (חוסכת רוחב פס בנייד), והסרת מטא-דאטה סופית נעשית בשרת.
 */
export function StepImages({
  images,
  error,
  onChange,
}: {
  images: DraftImage[];
  error?: string;
  onChange: (images: DraftImage[]) => void;
}) {
  const [uploading, setUploading] = React.useState(false);
  const [dragOver, setDragOver] = React.useState(false);
  const [dragIndex, setDragIndex] = React.useState<number | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function handleFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList).filter((f) => f.type.startsWith("image/"));
    if (!files.length) return;

    const room = MAX_IMAGES - images.length;
    if (room <= 0) {
      toast.error(`אפשר להעלות עד ${MAX_IMAGES} תמונות`);
      return;
    }
    const batch = files.slice(0, room);
    if (files.length > room) {
      toast.info(`נוספו ${room} תמונות בלבד — זו התקרה למודעה`);
    }

    setUploading(true);
    try {
      const compressed = await Promise.all(batch.map(compressImage));
      const form = new FormData();
      for (const file of compressed) form.append("files", file);

      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? "העלאת התמונות נכשלה");
        return;
      }
      if (data.errors?.length) {
        toast.warning(`חלק מהתמונות לא עלו: ${data.errors[0]}`);
      }
      onChange([...images, ...(data.images as DraftImage[])]);
    } catch {
      toast.error("העלאת התמונות נכשלה. בדקו את החיבור ונסו שוב.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= images.length || from === to) return;
    const next = [...images];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item!);
    onChange(next);
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-heading text-lg font-bold">תמונות המודעה</h2>
        <p className="text-sm text-muted-foreground">
          מודעות עם תמונות מקבלות פי 5 יותר פניות. התמונה הראשונה היא התמונה הראשית.
        </p>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex flex-col items-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition-colors",
          dragOver ? "border-primary bg-primary-soft/40" : "border-border",
        )}
      >
        <ImagePlus className="size-8 text-muted-foreground" aria-hidden />
        <p className="text-sm font-medium">גררו תמונות לכאן</p>
        <p className="text-xs text-muted-foreground">
          JPG, PNG או WebP · עד <span className="num">{MAX_IMAGES}</span> תמונות · עד 10MB לתמונה
        </p>
        <Button
          type="button"
          variant="outline"
          loading={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? <Loader2 className="animate-spin" aria-hidden /> : null}
          בחירת תמונות מהמכשיר
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={(e) => e.target.files && void handleFiles(e.target.files)}
        />
      </div>

      {error ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}

      {images.length ? (
        <>
          <p className="text-xs text-muted-foreground">
            גררו לשינוי הסדר, או השתמשו בחצים במקלדת אחרי מיקוד על התמונה.
          </p>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {images.map((img, i) => (
              <li
                key={img.url}
                draggable
                onDragStart={() => setDragIndex(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragIndex !== null) move(dragIndex, i);
                  setDragIndex(null);
                }}
                className={cn(
                  "group relative aspect-[4/3] overflow-hidden rounded-lg border-2 bg-muted",
                  i === 0 ? "border-primary" : "border-transparent",
                  dragIndex === i && "opacity-50",
                )}
              >
                <Image
                  src={img.thumbUrl ?? img.url}
                  alt={`תמונה ${i + 1}`}
                  fill
                  sizes="200px"
                  className="object-cover"
                  unoptimized
                />

                {i === 0 ? (
                  <span className="absolute start-1.5 top-1.5 flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                    <Star className="size-2.5 fill-current" aria-hidden />
                    ראשית
                  </span>
                ) : null}

                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/70 to-transparent p-1.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  <span className="grid size-7 place-items-center rounded-md text-white/80">
                    <GripVertical className="size-4" aria-hidden />
                  </span>
                  <div className="flex gap-1">
                    {i > 0 ? (
                      <button
                        type="button"
                        onClick={() => move(i, 0)}
                        className="rounded-md bg-white/90 px-2 py-1 text-[10px] font-bold text-foreground"
                      >
                        הפוך לראשית
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => onChange(images.filter((_, idx) => idx !== i))}
                      aria-label={`הסרת תמונה ${i + 1}`}
                      className="grid size-7 place-items-center rounded-md bg-destructive text-destructive-foreground"
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                    </button>
                  </div>
                </div>

                {/* ניווט מקלדת לשינוי סדר */}
                <button
                  type="button"
                  className="absolute inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  aria-label={`תמונה ${i + 1} מתוך ${images.length}. חצים להזזה`}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowLeft") {
                      e.preventDefault();
                      move(i, i + 1);
                    }
                    if (e.key === "ArrowRight") {
                      e.preventDefault();
                      move(i, i - 1);
                    }
                  }}
                />
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

/**
 * דוחס תמונה בדפדפן לפני ההעלאה.
 * `createImageBitmap` עם `imageOrientation: "from-image"` מיישר לפי EXIF,
 * והציור לקנבס משמיט ממילא את כל המטא-דאטה.
 */
async function compressImage(file: File): Promise<File> {
  if (file.size < 400_000) return file;

  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_CLIENT_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", CLIENT_QUALITY),
    );
    if (!blob || blob.size >= file.size) return file;

    return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" });
  } catch {
    // דפדפן ללא תמיכה — השרת יטפל בדחיסה בכל מקרה
    return file;
  }
}
