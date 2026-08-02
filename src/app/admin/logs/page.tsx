import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "יומן פעולות",
  robots: { index: false, follow: false },
};

const ACTION_LABELS: Record<string, string> = {
  "listing.publish": "פרסום מודעה",
  "listing.sold": "סימון כנמכרה",
  "listing.renew": "חידוש מודעה",
  "listing.pause": "השהיית מודעה",
  "listing.activate": "הפעלת מודעה",
  "listing.delete": "מחיקת מודעה",
  "listing.boost": "רכישת קידום",
  "moderation.dismiss_report": "דחיית דיווח",
  "moderation.clear_flags": "ניקוי סימוני הונאה",
  "moderation.ban_listing": "הסרת מודעה",
  "moderation.unban_listing": "החזרת מודעה",
  "moderation.block_user": "חסימת משתמש",
  "moderation.unblock_user": "הסרת חסימה",
};

const PAGE_SIZE = 60;

export default async function AdminLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageRaw } = await searchParams;
  const page = Math.max(1, Number(pageRaw) || 1);

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { actor: { select: { id: true, name: true, role: true } } },
    }),
    prisma.auditLog.count(),
  ]);

  const pages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        כל פעולה משמעותית באתר נרשמת כאן —{" "}
        <span className="num font-medium text-foreground">{total.toLocaleString("he-IL")}</span>{" "}
        רשומות.
      </p>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <caption className="sr-only">יומן פעולות המערכת</caption>
          <thead className="border-b border-border bg-muted/50 text-start">
            <tr>
              <th scope="col" className="p-3 text-start font-medium">
                מועד
              </th>
              <th scope="col" className="p-3 text-start font-medium">
                מבצע
              </th>
              <th scope="col" className="p-3 text-start font-medium">
                פעולה
              </th>
              <th scope="col" className="p-3 text-start font-medium">
                ישות
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {logs.map((log) => (
              <tr key={log.id}>
                <td className="num whitespace-nowrap p-3 text-xs text-muted-foreground">
                  {formatDate(log.createdAt, true)}
                </td>
                <td className="p-3">
                  {log.actor ? (
                    <Link href={`/u/${log.actor.id}`} className="hover:underline">
                      {log.actor.name}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">מערכת</span>
                  )}
                </td>
                <td className="p-3">
                  <Badge
                    variant={log.action.startsWith("moderation") ? "warning" : "muted"}
                  >
                    {ACTION_LABELS[log.action] ?? log.action}
                  </Badge>
                </td>
                <td className="num p-3 text-xs text-muted-foreground">
                  {log.entityType} · {log.entityId.slice(-8)}
                </td>
              </tr>
            ))}
            {logs.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-muted-foreground">
                  אין רשומות ביומן
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {pages > 1 ? (
        <nav aria-label="עימוד" className="flex items-center justify-center gap-3">
          {page > 1 ? (
            <Link
              href={`/admin/logs?page=${page - 1}`}
              className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
            >
              הקודם
            </Link>
          ) : null}
          <span className="num text-sm text-muted-foreground">
            עמוד {page} מתוך {pages}
          </span>
          {page < pages ? (
            <Link
              href={`/admin/logs?page=${page + 1}`}
              className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
            >
              הבא
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
