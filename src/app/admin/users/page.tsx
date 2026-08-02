import type { Metadata } from "next";
import Link from "next/link";

import { AdminSearchForm } from "@/components/admin/admin-search-form";
import { UserActions } from "@/components/admin/user-actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/db";
import { formatPhone, timeAgo } from "@/lib/utils";
import type { Prisma } from "@prisma/client";
import { formatCount } from "@/lib/format";

export const metadata: Metadata = {
  title: "ניהול משתמשים",
  robots: { index: false, follow: false },
};

const PAGE_SIZE = 40;

const ROLE_LABELS: Record<string, string> = {
  USER: "משתמש",
  BUSINESS: "עסקי",
  ADMIN: "מנהל",
};

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const { q, status, page: pageRaw } = await searchParams;
  const page = Math.max(1, Number(pageRaw) || 1);

  const where: Prisma.UserWhereInput = {
    deletedAt: null,
    ...(status === "blocked" ? { isBlocked: true } : {}),
    ...(status === "unverified" ? { verifiedAt: null } : {}),
    ...(status === "business" ? { role: "BUSINESS" } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { email: { contains: q, mode: "insensitive" as const } },
            { phone: { contains: q } },
          ],
        }
      : {}),
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        _count: { select: { listings: true, reviewsReceived: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return (
    <div className="space-y-4">
      <AdminSearchForm
        placeholder="חיפוש לפי שם, אימייל או טלפון…"
        statuses={[
          { value: "all", label: "כל המשתמשים" },
          { value: "blocked", label: "חסומים" },
          { value: "unverified", label: "ללא אימות טלפון" },
          { value: "business", label: "חשבונות עסקיים" },
        ]}
      />

      <p className="text-sm text-muted-foreground">
        <span className="num font-medium text-foreground">{formatCount(total)}</span>{" "}
        משתמשים
      </p>

      <ul className="divide-y divide-border rounded-lg border border-border bg-card">
        {users.map((u) => (
          <li key={u.id} className="flex flex-wrap items-center gap-3 p-3">
            <Avatar className="size-10 shrink-0">
              {u.avatar ? <AvatarImage src={u.avatar} alt="" /> : null}
              <AvatarFallback>{u.name.charAt(0)}</AvatarFallback>
            </Avatar>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/u/${u.id}`} className="font-medium hover:underline">
                  {u.name}
                </Link>
                <Badge variant={u.role === "ADMIN" ? "default" : u.role === "BUSINESS" ? "soft" : "muted"}>
                  {ROLE_LABELS[u.role] ?? u.role}
                </Badge>
                {u.isBlocked ? <Badge variant="destructive">חסום</Badge> : null}
                {u.verifiedAt ? null : <Badge variant="warning">לא מאומת</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">
                {u.email ?? "—"}
                {u.phone ? (
                  <>
                    {" · "}
                    <span className="num">{formatPhone(u.phone)}</span>
                  </>
                ) : null}
                {" · "}
                <span className="num">{u._count.listings}</span> מודעות ·{" "}
                <span className="num">{u.ratingAvg.toFixed(1)}</span> ({u._count.reviewsReceived}) ·
                נרשם {timeAgo(u.createdAt)}
              </p>
            </div>

            <UserActions userId={u.id} isBlocked={u.isBlocked} role={u.role} />
          </li>
        ))}
        {users.length === 0 ? (
          <li className="p-8 text-center text-sm text-muted-foreground">
            לא נמצאו משתמשים
          </li>
        ) : null}
      </ul>
    </div>
  );
}
