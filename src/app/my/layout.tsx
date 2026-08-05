import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { MyNav } from "@/components/my/my-nav";

export default async function MyLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/auth/login?callbackUrl=/my");

  const userId = session.user.id;

  // ספירות לתגיות שליד פריטי הניווט
  const [listings, favorites, searches, unreadMessages, unreadNotifications] =
    await Promise.all([
      prisma.listing.count({ where: { userId, deletedAt: null } }),
      prisma.favorite.count({ where: { userId } }),
      prisma.savedSearch.count({ where: { userId } }),
      prisma.conversation.count({
        where: {
          OR: [
            { buyerId: userId, messages: { some: {} } },
            { sellerId: userId, messages: { some: {} } },
          ],
        },
      }),
      prisma.notification.count({ where: { userId, readAt: null } }),
    ]);

  // לוח הסוחר מוצג רק לחשבונות עסקיים — למשתמש פרטי אין בו דבר
  const business = await prisma.user.findUnique({
    where: { id: userId },
    select: { businessName: true },
  });

  const items = [
    { href: "/my", label: "המודעות שלי", icon: "LayoutDashboard", count: listings, exact: true },
    { href: "/my/messages", label: "הודעות", icon: "MessageCircle", count: unreadMessages },
    { href: "/my/favorites", label: "מועדפים", icon: "Heart", count: favorites },
    { href: "/my/searches", label: "חיפושים שמורים", icon: "Search", count: searches },
    { href: "/my/notifications", label: "התראות", icon: "Bell", count: unreadNotifications },
    ...(business?.businessName
      ? [{ href: "/my/business", label: "לוח הסוחר", icon: "Store", count: 0 }]
      : []),
    { href: "/my/profile", label: "הפרופיל שלי", icon: "UserRound", count: 0 },
  ];

  return (
    <div className="container py-6">
      <div className="flex flex-col gap-6 lg:flex-row">
        <aside className="lg:w-56 lg:shrink-0">
          <MyNav items={items} />
        </aside>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
