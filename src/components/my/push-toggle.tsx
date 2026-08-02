"use client";

import * as React from "react";
import { Bell, BellOff } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

/**
 * הרשמה / ביטול של התראות Push בדפדפן.
 * מוצג רק כשהדפדפן תומך וכשמוגדר מפתח VAPID ציבורי.
 */
export function PushToggle() {
  const [supported, setSupported] = React.useState(false);
  const [subscribed, setSubscribed] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  React.useEffect(() => {
    if (!vapidKey) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    setSupported(true);
    void (async () => {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setSubscribed(Boolean(sub));
    })();
  }, [vapidKey]);

  if (!supported) return null;

  async function subscribe() {
    setPending(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error("ההרשאה נדחתה. אפשר לשנות זאת בהגדרות הדפדפן.");
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey!),
      });

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) {
        toast.error("ההרשמה להתראות נכשלה");
        return;
      }
      setSubscribed(true);
      toast.success("התראות Push הופעלו");
    } catch {
      toast.error("ההרשמה להתראות נכשלה");
    } finally {
      setPending(false);
    }
  }

  async function unsubscribe() {
    setPending(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setSubscribed(false);
      toast.success("התראות Push בוטלו");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3.5">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
        {subscribed ? <Bell className="size-4" aria-hidden /> : <BellOff className="size-4" aria-hidden />}
      </span>
      <div className="flex-1 text-sm">
        <p className="font-medium">התראות Push למכשיר</p>
        <p className="text-xs text-muted-foreground">
          {subscribed
            ? "תקבלו התראה מיידית גם כשהאתר סגור."
            : "הפעילו כדי לקבל התראה על הודעות ומודעות חדשות שמתאימות לכם."}
        </p>
      </div>
      <Button
        variant={subscribed ? "outline" : "default"}
        size="sm"
        loading={pending}
        onClick={() => void (subscribed ? unsubscribe() : subscribe())}
      >
        {subscribed ? "ביטול" : "הפעלה"}
      </Button>
    </div>
  );
}

/** ממיר מפתח VAPID מ-base64url ל-ArrayBuffer, כפי ש-PushManager דורש. */
function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return buffer;
}
