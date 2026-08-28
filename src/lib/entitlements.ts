import { prisma } from "@/lib/db";
import { FREE_BUSINESS_QUOTA, planById, type DealerPlan } from "@/lib/plans";

/**
 * מה המנוי באמת נותן.
 *
 * מנוי שנותן "תג" ו"עדיפות" הוא מנוי שאי אפשר להסביר ואי אפשר לאכוף.
 * כאן הוא נותן דבר אחד שנמדד: **מכסת מודעות פעילות לחנות**. כל שאר
 * ההבדלים בין החבילות נגזרים ממנה.
 *
 * המכסה חלה על העסק ולא על האדם, ולכן היא סופרת גם מודעות שסוכנים
 * פרסמו בשמו — אחרת סוכנות עם חמישה סוכנים הייתה מקבלת פי חמישה.
 */

export type Entitlement = {
  plan: DealerPlan | null;
  /** `null` = ללא הגבלה */
  quota: number | null;
  used: number;
  /** האם אפשר לפרסם עוד מודעה */
  canPublish: boolean;
  /** תוקף המנוי, כשיש */
  periodEnd: Date | null;
  status: "none" | "active" | "past_due" | "cancelled";
};

/** ספירת המלאי הפעיל של חנות — אותו תנאי בדיוק כמו בעמוד הציבורי. */
export function activeInventoryWhere(businessId: string) {
  return {
    status: "ACTIVE" as const,
    deletedAt: null,
    OR: [{ businessId }, { userId: businessId }],
  };
}

/**
 * ההרשאות של חנות נכון לעכשיו.
 *
 * מנוי שתוקפו עבר מדווח כ-`past_due` והמכסה יורדת לחינמית — הוא אינו
 * נמחק. סוחר שלא שילם החודש אינו אמור לאבד את המלאי שלו; הוא אמור
 * לא להוסיף עוד, ולראות למה.
 */
export async function entitlementFor(businessId: string): Promise<Entitlement> {
  const [subscription, used] = await Promise.all([
    prisma.subscription.findUnique({ where: { businessId } }),
    prisma.listing.count({ where: activeInventoryWhere(businessId) }),
  ]);

  const now = new Date();
  const expired = !subscription || subscription.currentPeriodEnd <= now;
  const plan = subscription ? (planById(subscription.planId) ?? null) : null;

  const status: Entitlement["status"] = !subscription
    ? "none"
    : expired
      ? subscription.cancelAtPeriodEnd
        ? "cancelled"
        : "past_due"
      : subscription.cancelAtPeriodEnd
        ? "cancelled"
        : "active";

  const effectivePlan = expired ? null : plan;
  const quota = effectivePlan ? effectivePlan.listingQuota : FREE_BUSINESS_QUOTA;

  return {
    plan: effectivePlan,
    quota,
    used,
    canPublish: quota === null || used < quota,
    periodEnd: subscription?.currentPeriodEnd ?? null,
    status,
  };
}
