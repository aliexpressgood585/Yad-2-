import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PlanPicker } from "@/components/business/plan-picker";
import { auth } from "@/lib/auth";
import { activeMembership } from "@/lib/business";
import { entitlementFor } from "@/lib/entitlements";
import { DEALER_PLANS } from "@/lib/plans";
import { paymentsEnabled } from "@/lib/payments";
import { formatCount } from "@/lib/format";

export const metadata: Metadata = {
  title: "החבילה שלי",
  robots: { index: false, follow: false },
};

const STATUS_TEXT: Record<string, string> = {
  none: "אין מנוי פעיל",
  active: "מנוי פעיל",
  past_due: "המנוי פג ולא חודש",
  cancelled: "המנוי בוטל",
};

export default async function PlanPage() {
  const session = await auth();
  const membership = await activeMembership(session!.user.id);
  if (!membership) redirect("/my/profile");
  if (membership.role !== "OWNER") redirect("/my/business");

  const entitlement = await entitlementFor(membership.businessId);

  return (
    <div className="space-y-5">
      <section className="border border-border bg-card p-4">
        <h2 className="font-heading text-base">
          {entitlement.plan ? entitlement.plan.name : "ללא מנוי"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {STATUS_TEXT[entitlement.status]}
          {entitlement.periodEnd ? (
            <>
              {" · "}
              בתוקף עד{" "}
              <span className="num">
                {entitlement.periodEnd.toLocaleDateString("he-IL")}
              </span>
            </>
          ) : null}
        </p>

        <p className="mt-3 text-sm">
          <span className="num font-semibold">{formatCount(entitlement.used)}</span> מודעות
          פעילות
          {entitlement.quota === null ? (
            " · ללא הגבלה"
          ) : (
            <>
              {" מתוך "}
              <span className="num font-semibold">{formatCount(entitlement.quota)}</span>
            </>
          )}
        </p>

        {/*
         * פס המכסה נעלם כשאין תקרה. פס מלא ב-100% שמשמעותו "ללא
         * הגבלה" הוא בדיוק הפוך ממה שהוא נראה.
         */}
        {entitlement.quota !== null ? (
          <div className="mt-2 h-2 w-full max-w-sm bg-muted">
            <div
              className={
                entitlement.canPublish ? "h-full bg-primary" : "h-full bg-accent"
              }
              style={{
                width: `${Math.min(100, (entitlement.used / entitlement.quota) * 100)}%`,
              }}
            />
          </div>
        ) : null}

        {!entitlement.canPublish ? (
          <p className="mt-2 text-sm text-accent">
            החנות הגיעה למכסה. פרסום מודעה חדשה ייחסם עד לשדרוג או לסגירת מודעה קיימת.
          </p>
        ) : null}
      </section>

      <PlanPicker
        plans={DEALER_PLANS}
        currentPlanId={entitlement.plan?.id ?? null}
        paymentsEnabled={paymentsEnabled()}
      />
    </div>
  );
}
