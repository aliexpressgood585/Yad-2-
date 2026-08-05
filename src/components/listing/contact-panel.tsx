"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { MessageCircle, Phone, Send, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { SafeDealTips } from "@/components/listing/safe-deal-tips";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatPhone, toWhatsAppNumber } from "@/lib/utils";

type Props = {
  listingId: string;
  slug: string;
  title: string;
  contactName: string;
  allowChat: boolean;
  isOwner: boolean;
  isActive: boolean;
  /** שורש הקטגוריה — קובע אילו אזהרות עסקה מוצגות */
  rootSlug?: string | null;
  /** האם המודעה סומנה על ידי מנוע הסיכון */
  flagged?: boolean;
};

const QUICK_MESSAGES = [
  "היי, המודעה עדיין רלוונטית?",
  "אפשר לתאם צפייה השבוע?",
  "מה המחיר הסופי?",
];

export function ContactPanel({
  listingId,
  slug,
  title,
  contactName,
  allowChat,
  isOwner,
  isActive,
  rootSlug,
  flagged = false,
}: Props) {
  const router = useRouter();
  const { status } = useSession();

  const [phone, setPhone] = React.useState<string | null>(null);
  const [revealing, setRevealing] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const [sending, setSending] = React.useState(false);

  async function revealPhone() {
    setRevealing(true);
    try {
      const res = await fetch(`/api/listings/${listingId}/reveal`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "לא הצלחנו להציג את מספר הטלפון");
        return;
      }
      if (!data.phone) {
        toast.info("המוכר לא פרסם מספר טלפון. אפשר לפנות אליו בהודעה.");
        return;
      }
      setPhone(data.phone);
    } finally {
      setRevealing(false);
    }
  }

  async function sendMessage(body: string) {
    if (status !== "authenticated") {
      router.push(`/auth/login?callbackUrl=/item/${slug}`);
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ listingId, body }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "שליחת ההודעה נכשלה");
        return;
      }
      toast.success("ההודעה נשלחה למוכר");
      setMessage("");
      router.push(`/my/messages/${data.conversationId}`);
    } finally {
      setSending(false);
    }
  }

  if (isOwner) {
    return (
      <Card>
        <CardContent className="space-y-3 p-4">
          <p className="text-sm text-muted-foreground">זו המודעה שלך.</p>
          <div className="flex gap-2">
            <Button asChild className="flex-1">
              <Link href={`/publish/${listingId}/edit`}>עריכת המודעה</Link>
            </Button>
            <Button asChild variant="outline" className="flex-1">
              <Link href="/my">לאזור האישי</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const waText = encodeURIComponent(
    `היי, ראיתי את המודעה "${title}" בלוח. היא עדיין רלוונטית?`,
  );

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <p className="text-sm">
          יצירת קשר עם <span className="font-semibold">{contactName}</span>
        </p>

        {!isActive ? (
          <p className="rounded-md bg-muted p-2.5 text-xs text-muted-foreground">
            המודעה אינה פעילה, אך עדיין אפשר לפנות למוכר.
          </p>
        ) : null}

        {phone ? (
          <div className="space-y-2">
            <a
              href={`tel:${phone}`}
              className="flex h-12 items-center justify-center gap-2 rounded-md bg-primary text-lg font-bold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Phone className="size-5" aria-hidden />
              <span className="num">{formatPhone(phone)}</span>
            </a>
            <a
              href={`https://wa.me/${toWhatsAppNumber(phone)}?text=${waText}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-11 items-center justify-center gap-2 rounded-md bg-[#25D366] text-sm font-bold text-white transition-opacity hover:opacity-90"
            >
              <svg viewBox="0 0 24 24" className="size-5 fill-current" aria-hidden>
                <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.39-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.01-1.04 2.47s1.06 2.86 1.21 3.06c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.28.17-1.41-.07-.13-.27-.2-.57-.35ZM12.05 21.5h-.01a9.42 9.42 0 0 1-4.8-1.32l-.35-.2-3.57.94.95-3.48-.22-.36a9.4 9.4 0 0 1 14.6-11.65 9.4 9.4 0 0 1-6.6 16.07ZM20.52 3.48A11.8 11.8 0 0 0 12.05 0C5.5 0 .17 5.33.17 11.88c0 2.1.55 4.14 1.6 5.95L.07 24l6.34-1.66a11.85 11.85 0 0 0 5.64 1.44h.01c6.55 0 11.88-5.33 11.88-11.88 0-3.17-1.24-6.16-3.48-8.42Z" />
              </svg>
              שליחת הודעה בוואטסאפ
            </a>
          </div>
        ) : (
          <Button size="lg" className="w-full" loading={revealing} onClick={revealPhone}>
            <Phone aria-hidden />
            הצגת מספר הטלפון
          </Button>
        )}

        {/*
         * אזהרות העסקה נפתחות **עם המספר** ולא לפניו.
         *
         * מנוע הסיכון כבר מסמן מודעות חשודות למודרציה, אבל הרגע שבו
         * הקונה באמת בסכנה אינו הרגע שבו הוא רואה את המודעה — הוא
         * הרגע שבו הוא עומד להתקשר, ומשם הכל קורה מחוץ למערכת.
         * אזהרה בדף המודעה נקראת כרעש רקע; אזהרה שנפתחת עם המספר
         * נקראת.
         */}
        {phone ? <SafeDealTips rootSlug={rootSlug} flagged={flagged} /> : null}

        {allowChat ? (
          <>
            <div className="relative py-1 text-center">
              <span className="relative z-10 bg-card px-3 text-xs text-muted-foreground">
                או שלחו הודעה
              </span>
              <span className="absolute inset-x-0 top-1/2 h-px bg-border" aria-hidden />
            </div>

            <div className="space-y-2">
              <Label htmlFor="quick-message" className="sr-only">
                הודעה למוכר
              </Label>
              <Textarea
                id="quick-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="כתבו הודעה למוכר…"
                rows={3}
                maxLength={2000}
              />
              <div className="flex flex-wrap gap-1.5">
                {QUICK_MESSAGES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMessage(m)}
                    className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                  >
                    {m}
                  </button>
                ))}
              </div>
              <Button
                variant="outline"
                className="w-full"
                loading={sending}
                disabled={message.trim().length === 0}
                onClick={() => void sendMessage(message.trim())}
              >
                <Send aria-hidden />
                שליחת הודעה
              </Button>
            </div>
          </>
        ) : (
          <p className="flex items-center gap-2 rounded-md bg-muted p-2.5 text-xs text-muted-foreground">
            <MessageCircle className="size-4 shrink-0" aria-hidden />
            המוכר בחר לקבל פניות בטלפון בלבד.
          </p>
        )}

        <p className="flex items-start gap-2 rounded-md bg-primary-soft/60 p-2.5 text-xs text-primary">
          <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            אל תעבירו כסף מראש ואל תמסרו פרטי אשראי.{" "}
            <Link href="/safety" className="underline">
              מדריך בטיחות
            </Link>
          </span>
        </p>
      </CardContent>
    </Card>
  );
}
