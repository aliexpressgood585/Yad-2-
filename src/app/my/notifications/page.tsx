import type { Metadata } from "next";
import Link from "next/link";
import { Bell } from "lucide-react";

import { MarkAllRead } from "@/components/my/mark-all-read";
import { NotificationPreferences } from "@/components/my/notification-preferences";
import { PushToggle } from "@/components/my/push-toggle";
import { EmptyResults } from "@/components/listing/listing-grid";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { cn, timeAgo } from "@/lib/utils";

export const metadata: Metadata = {
  title: "התראות",
  robots: { index: false, follow: false },
};

export default async function NotificationsPage() {
  const session = await auth();

  const [notifications, preferences] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: session!.user.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.user.findUniqueOrThrow({
      where: { id: session!.user.id },
      select: {
        notifyEmail: true,
        notifyPush: true,
        quietHours: true,
        monthlyReport: true,
      },
    }),
  ]);

  const unread = notifications.filter((n) => !n.readAt).length;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-extrabold">התראות</h1>
          <p className="text-sm text-muted-foreground">
            {unread > 0 ? (
              <>
                <span className="num font-medium text-foreground">{unread}</span> התראות
                שלא נקראו
              </>
            ) : (
              "הכול מעודכן"
            )}
          </p>
        </div>
        {unread > 0 ? <MarkAllRead /> : null}
      </header>

      <PushToggle />

      <NotificationPreferences initial={preferences} />

      {notifications.length === 0 ? (
        <EmptyResults
          title="אין התראות"
          body="כשמישהו ישלח לך הודעה או שתתפרסם מודעה שמתאימה לחיפוש שמור — נעדכן אותך כאן."
        />
      ) : (
        <ul className="space-y-2">
          {notifications.map((n) => {
            const content = (
              <div
                className={cn(
                  "flex gap-3 rounded-lg border p-3.5 transition-colors",
                  n.readAt
                    ? "border-border bg-card"
                    : "border-primary/30 bg-primary-soft/40",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg",
                    n.readAt ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground",
                  )}
                >
                  <Bell className="size-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{n.title}</p>
                  <p className="text-sm text-muted-foreground">{n.body}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {timeAgo(n.createdAt)}
                  </p>
                </div>
              </div>
            );

            return (
              <li key={n.id}>
                {n.url ? (
                  <Link href={n.url} className="block rounded-lg focus-visible:ring-2 focus-visible:ring-ring">
                    {content}
                  </Link>
                ) : (
                  content
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
