"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/format";
import type { DealerPlan } from "@/lib/plans";
import { cn } from "@/lib/utils";

/**
 * בחירת חבילת מנוי.
 *
 * הכפתור פותח **הזמנה**, לא מנוי. המנוי נפתח רק כשההזמנה משולמת
 * בפועל (`fulfillOrder`), ולכן אין כאן מסלול שבו מישהו מקבל מכסה בלי
 * לשלם. בלי ספק סליקה מוגדר הכפתורים כבויים והמסך אומר למה.
 */
export function PlanPicker({
  plans,
  currentPlanId,
  paymentsEnabled,
}: {
  plans: DealerPlan[];
  currentPlanId: string | null;
  paymentsEnabled: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);

  async function pick(planId: string) {
    setBusy(planId);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: "SUBSCRIPTION", planId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "פתיחת ההזמנה נכשלה");
        return;
      }
      if (data.checkout?.mode === "redirect") {
        window.location.href = data.checkout.url;
        return;
      }
      router.push(`/my/orders/${data.orderId}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      {!paymentsEnabled ? (
        <p className="border border-border bg-muted p-3 text-sm text-muted-foreground">
          התשלום אינו זמין כרגע ולכן אי אפשר לרכוש מנוי. אפשר לפנות אלינו ונעדכן
          ברגע שהוא ייפתח.
        </p>
      ) : null}

      <ul className="grid gap-px bg-border sm:grid-cols-3">
        {plans.map((plan) => {
          const current = plan.id === currentPlanId;
          return (
            <li key={plan.id} className="flex flex-col bg-card p-4">
              <h3 className="font-heading text-base">{plan.name}</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">{plan.description}</p>

              <p className="num mt-3 font-heading text-2xl">
                {formatPrice(plan.priceIls)}
                <span className="text-sm font-normal text-muted-foreground"> לחודש</span>
              </p>

              <ul className="mt-3 flex-1 space-y-1 text-xs text-muted-foreground">
                {plan.features.map((f) => (
                  <li key={f}>· {f}</li>
                ))}
              </ul>

              <Button
                variant={current ? "outline" : "default"}
                className={cn("mt-4")}
                disabled={!paymentsEnabled || busy !== null}
                loading={busy === plan.id}
                onClick={() => void pick(plan.id)}
              >
                {current ? "חידוש החבילה" : "בחירה"}
              </Button>
            </li>
          );
        })}
      </ul>
    </>
  );
}
