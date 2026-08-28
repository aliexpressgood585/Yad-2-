"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * אישור וזיכוי הזמנה.
 *
 * אישור ידני דורש אסמכתה. זו אינה בירוקרטיה: אישור בלי מספר העברה הוא
 * שורה במסד שאי אפשר להצליב מול דף הבנק, ובדיוק שם כסף נעלם. הפעולה
 * נרשמת גם ב-`AuditLog` עם מי אישר.
 */
export function OrderActions({ orderId, status }: { orderId: string; status: string }) {
  const router = useRouter();
  const [reference, setReference] = React.useState("");
  const [busy, setBusy] = React.useState<string | null>(null);

  async function act(action: "mark-paid" | "refund" | "cancel") {
    if (action === "mark-paid" && !reference.trim()) {
      toast.error("יש להזין אסמכתה של ההעברה");
      return;
    }
    if (action !== "mark-paid" && !window.confirm("לבצע את הפעולה?")) return;

    setBusy(action);
    try {
      const res = await fetch("/api/admin/orders", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderId, action, reference: reference.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "הפעולה נכשלה");
        return;
      }
      toast.success(
        action === "mark-paid"
          ? data.applied
            ? "ההזמנה סומנה כשולמה והוענקה"
            : "ההזמנה כבר הייתה משולמת"
          : action === "refund"
            ? "ההזמנה זוכתה"
            : "ההזמנה בוטלה",
      );
      setReference("");
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  if (status === "PENDING") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="אסמכתת העברה"
          dir="ltr"
          className="h-9 w-44"
          aria-label="אסמכתת ההעברה הבנקאית"
        />
        <Button size="sm" loading={busy === "mark-paid"} onClick={() => void act("mark-paid")}>
          סימון כשולמה
        </Button>
        <Button
          size="sm"
          variant="ghost"
          loading={busy === "cancel"}
          onClick={() => void act("cancel")}
        >
          ביטול
        </Button>
      </div>
    );
  }

  if (status === "PAID") {
    return (
      <Button
        size="sm"
        variant="outline"
        loading={busy === "refund"}
        onClick={() => void act("refund")}
      >
        זיכוי
      </Button>
    );
  }

  return null;
}
