"use client";

import * as React from "react";
import { toast } from "sonner";
import { ArrowRight, Smartphone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  purpose: "login" | "verify";
  /** מוחזר `true` כשהאימות הצליח. */
  onVerify: (phone: string, code: string) => Promise<boolean>;
  initialPhone?: string;
};

const RESEND_SECONDS = 45;

/** שלב 1: הזנת טלפון ושליחת קוד. שלב 2: הזנת הקוד. */
export function OtpFields({ purpose, onVerify, initialPhone = "" }: Props) {
  const [phone, setPhone] = React.useState(initialPhone);
  const [code, setCode] = React.useState("");
  const [stage, setStage] = React.useState<"phone" | "code">("phone");
  const [loading, setLoading] = React.useState(false);
  const [cooldown, setCooldown] = React.useState(0);
  const codeRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone, purpose }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "שליחת הקוד נכשלה");
        return;
      }
      setStage("code");
      setCooldown(RESEND_SECONDS);
      setTimeout(() => codeRef.current?.focus(), 50);

      if (data.devCode) {
        // בסביבת פיתוח אין ספק SMS — הקוד מוצג כדי לאפשר בדיקה
        toast.info(`קוד לפיתוח: ${data.devCode}`, { duration: 20_000 });
      } else {
        toast.success("קוד אימות נשלח אליך ב-SMS");
      }
    } finally {
      setLoading(false);
    }
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const okResult = await onVerify(phone, code);
      if (!okResult) setCode("");
    } finally {
      setLoading(false);
    }
  }

  if (stage === "phone") {
    return (
      <form onSubmit={sendCode} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="otp-phone" required>
            מספר טלפון נייד
          </Label>
          <Input
            id="otp-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            required
            dir="ltr"
            placeholder="050-000-0000"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            נשלח אליך קוד בן 6 ספרות ב-SMS. לא נשתמש במספר לפרסום.
          </p>
        </div>
        <Button type="submit" className="w-full" size="lg" loading={loading}>
          <Smartphone aria-hidden />
          שליחת קוד
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={submitCode} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="otp-code" required>
          קוד האימות
        </Label>
        <Input
          id="otp-code"
          ref={codeRef}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          required
          dir="ltr"
          placeholder="------"
          className="text-center font-mono text-2xl tracking-[0.4em]"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        />
        <p className="text-xs text-muted-foreground">
          הקוד נשלח למספר <span className="num font-medium">{phone}</span>.{" "}
          <button
            type="button"
            className="underline hover:text-foreground disabled:no-underline disabled:opacity-60"
            onClick={() => setStage("phone")}
          >
            שינוי מספר
          </button>
        </p>
      </div>

      <Button
        type="submit"
        className="w-full"
        size="lg"
        loading={loading}
        disabled={code.length !== 6}
      >
        אישור
        <ArrowRight className="rotate-180" aria-hidden />
      </Button>

      <Button
        type="button"
        variant="ghost"
        className="w-full"
        disabled={cooldown > 0 || loading}
        onClick={() => void sendCode()}
      >
        {cooldown > 0 ? `אפשר לשלוח שוב בעוד ${cooldown} שניות` : "שליחת הקוד מחדש"}
      </Button>
    </form>
  );
}
