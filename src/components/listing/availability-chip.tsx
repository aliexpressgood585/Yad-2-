"use client";

import { useState } from "react";
import { Check, Clock } from "lucide-react";

import { freshnessLabel, freshnessOf } from "@/lib/availability";
import { cn } from "@/lib/utils";

/**
 * תג הטריות של המודעה, שהוא גם הכפתור.
 *
 * לקונה — "עדיין רלוונטי?" בלחיצה, במקום הודעה שלא מקדמת אף עסקה.
 * למוכר — "אשר זמינות" באותו מקום בדיוק.
 *
 * **אותו רכיב לשני התפקידים ובאותו מיקום.** התג הוא המצב והפעולה גם
 * יחד: מי שמסתכל על המודעה רואה מיד כמה הנתון טרי, ומי שיכול לשנות
 * את זה רואה את הכפתור באותו מקום שבו הוא כבר מסתכל.
 */
export function AvailabilityChip({
  listingId,
  availabilityAt,
  publishedAt,
  isOwner,
  className,
}: {
  listingId: string;
  availabilityAt: string | null;
  publishedAt: string | null;
  isOwner: boolean;
  className?: string;
}) {
  const [confirmedAt, setConfirmedAt] = useState<string | null>(availabilityAt);
  const [asked, setAsked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const state = freshnessOf({
    availabilityAt: confirmedAt ? new Date(confirmedAt) : null,
    publishedAt: publishedAt ? new Date(publishedAt) : null,
  });

  async function send(action: "ask" | "confirm") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/listings/${listingId}/availability`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "הפעולה נכשלה");
        return;
      }
      if (action === "confirm") setConfirmedAt(data.availabilityAt);
      else setAsked(true);
    } catch {
      setError("לא ניתן היה לפנות לשרת.");
    } finally {
      setBusy(false);
    }
  }

  const tone =
    state.kind === "stale"
      ? "border-accent/50 text-accent"
      : state.kind === "confirmed"
        ? "border-info/50 text-info"
        : "border-border text-muted-foreground";

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <span
        className={cn("inline-flex items-center gap-1.5 border px-2.5 py-1 text-xs", tone)}
      >
        {state.kind === "confirmed" ? (
          <Check className="size-3.5" aria-hidden />
        ) : (
          <Clock className="size-3.5" aria-hidden />
        )}
        {freshnessLabel(state)}
      </span>

      {isOwner ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void send("confirm")}
          className="border border-border bg-secondary px-2.5 py-1 text-xs font-medium disabled:opacity-50"
        >
          {busy ? "מאשר…" : "אישור זמינות"}
        </button>
      ) : asked ? (
        /*
         * אותה תשובה גם כשמישהו אחר כבר שאל היום. מבחינת הקונה המצב
         * זהה — המוכר קיבל את הבקשה — ולספר לו שהוא איחר היה מידע
         * חסר תועלת שנשמע כמו דחייה.
         */
        <span className="text-xs text-muted-foreground">נשלחה בקשה למוכר</span>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => void send("ask")}
          className="border border-border px-2.5 py-1 text-xs font-medium transition-colors duration-ui ease-ui hover:border-primary hover:text-primary disabled:opacity-50"
        >
          {busy ? "שולח…" : "עדיין רלוונטי?"}
        </button>
      )}

      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </div>
  );
}
