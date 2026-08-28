import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { TeamManager, type TeamRow } from "@/components/business/team-manager";
import { auth } from "@/lib/auth";
import { activeMembership, permissionsFor } from "@/lib/business";
import { prisma } from "@/lib/db";

export const metadata: Metadata = {
  title: "צוות",
  robots: { index: false, follow: false },
};

export default async function TeamPage() {
  const session = await auth();
  const membership = await activeMembership(session!.user.id);
  if (!membership || !permissionsFor(membership.role).manageTeam) {
    redirect("/my/business");
  }

  const [owner, members] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: membership.businessId },
      select: { name: true, email: true },
    }),
    prisma.businessMember.findMany({
      where: { businessId: membership.businessId },
      select: {
        role: true,
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  /*
   * ספירת המודעות היא לפי `businessId` **וגם** `userId`: מודעה פרטית
   * של אותו אדם אינה נספרת כמלאי של העסק, וזו בדיוק ההפרדה שהמודל
   * קיים בשבילה.
   */
  const counts = await prisma.listing.groupBy({
    by: ["userId"],
    where: { businessId: membership.businessId, deletedAt: null },
    _count: true,
  });
  const byUser = new Map(counts.map((c) => [c.userId, c._count]));

  const rows: TeamRow[] = members.map((m) => ({
    userId: m.user.id,
    name: m.user.name,
    email: m.user.email,
    role: m.role === "MANAGER" ? "MANAGER" : "AGENT",
    listings: byUser.get(m.user.id) ?? 0,
  }));

  return (
    <TeamManager
      owner={{
        name: owner.name,
        email: owner.email,
        listings: byUser.get(membership.businessId) ?? 0,
      }}
      members={rows}
    />
  );
}
