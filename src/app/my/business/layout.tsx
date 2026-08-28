import { redirect } from "next/navigation";

import { BusinessTabs } from "@/components/business/business-tabs";
import { auth } from "@/lib/auth";
import { activeMembership, permissionsFor, ROLE_LABELS } from "@/lib/business";

/**
 * אזור הכלים לעסק.
 *
 * הלשוניות נגזרות מההרשאות בפועל ולא מוסתרות ב-CSS: סוכן אינו רואה
 * "העלאה מרוכזת" כי הוא אינו רשאי, וגם אם ינחש את הכתובת ה-API יסרב.
 * שכבת ההרשאה היחידה שקובעת היא `requireBusiness`.
 */
export default async function BusinessLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/auth/login?callbackUrl=/my/business");

  const membership = await activeMembership(session.user.id);
  if (!membership) redirect("/my/profile");

  const permissions = permissionsFor(membership.role);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-heading text-2xl">{membership.businessName}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          התפקיד שלך בעסק: {ROLE_LABELS[membership.role]}
          {membership.role === "AGENT" ? " — מוצגות המודעות שפרסמת" : ""}
        </p>
      </header>

      <BusinessTabs
        canImport={permissions.importInventory}
        canManageTeam={permissions.manageTeam}
      />

      {children}
    </div>
  );
}
