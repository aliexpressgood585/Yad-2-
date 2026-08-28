import { redirect } from "next/navigation";
import { Shield } from "lucide-react";

import { AdminNav } from "@/components/admin/admin-nav";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  // ה-middleware כבר חוסם, אבל בדיקה בשרת היא ההגנה האמיתית
  if (!session?.user) redirect("/auth/login?callbackUrl=/admin");
  if (session.user.role !== "ADMIN") redirect("/");

  const [openReports, flagged, pendingOrders] = await Promise.all([
    prisma.report.count({ where: { status: "OPEN" } }),
    prisma.listing.count({ where: { fraudScore: { gte: 30 }, status: "ACTIVE", deletedAt: null } }),
    prisma.order.count({ where: { status: "PENDING" } }),
  ]);

  return (
    <div className="container py-6">
      <header className="mb-5 flex items-center gap-2.5">
        <span className="grid size-10 place-items-center rounded-lg bg-foreground text-background">
          <Shield className="size-5" aria-hidden />
        </span>
        <div>
          <h1 className="font-heading text-xl font-extrabold">פאנל ניהול</h1>
          <p className="text-xs text-muted-foreground">
            מחובר כ־{session.user.name}
          </p>
        </div>
      </header>

      <AdminNav openReports={openReports} flagged={flagged} pendingOrders={pendingOrders} />

      <div className="mt-5">{children}</div>
    </div>
  );
}
