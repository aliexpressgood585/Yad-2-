"use client";

import * as React from "react";
import { Check, Link2, Share2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

/** שיתוף דרך Web Share API, עם נפילה חזרה להעתקת הקישור. */
export function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = React.useState(false);

  async function share() {
    const url = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // המשתמש ביטל את השיתוף — ממשיכים להעתקה
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("הקישור הועתק");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("לא הצלחנו להעתיק את הקישור");
    }
  }

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={share}
      aria-label="שיתוף המודעה"
      title="שיתוף המודעה"
    >
      {copied ? <Check aria-hidden /> : <Share2 aria-hidden />}
    </Button>
  );
}

/** גרסה עם טקסט, לשימוש בתוך תפריטים. */
export function ShareLinkButton({ title }: { title: string }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(window.location.href);
          toast.success("הקישור הועתק");
        } catch {
          toast.error("לא הצלחנו להעתיק את הקישור");
        }
      }}
    >
      <Link2 aria-hidden />
      העתקת קישור ל{title}
    </Button>
  );
}
