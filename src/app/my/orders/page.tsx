import type { Metadata } from "next";
import Link from "next/link";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatPrice } from "@/lib/format";
import { agorotToShekels } from "@/lib/plans";
import { cn, timeAgo } from "@/lib/utils";

export const metadata: Metadata = {
  title: "הזמנות",
  robots: { index: false, follow: false },
};

const STATUS: Record<string, { label: string; className: string }> = {
  PENDING: { label: "ממתינה לתשלום", className: "text-muted-foreground" },
  PAID: { label: "שולמה", className: "text-info" },
  FAILED: { label: "נכשלה", className: "text-accent" },
  CANCELLED: { label: "בוטלה", className: "text-muted-foreground" },
  REFUNDED: { label: "זוכתה", className: "text-accent" },
};

export default async function OrdersPage() {
  const session = await auth();
  const orders = await prisma.order.findMany({
    where: { userId: session!.user.id },
    orderBy: { createdAt: "desc" },
    include: { invoice: { select: { number: true } } },
    take: 100,
  });

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-heading text-2xl">הזמנות</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          קידומים ומנויים. חשבונית זמינה לכל הזמנה ששולמה.
        </p>
      </header>

      {orders.length === 0 ? (
        <p className="border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          אין עדיין הזמנות.
        </p>
      ) : (
        <ul className="flex flex-col gap-px bg-border">
          {orders.map((order) => {
            const status = STATUS[order.status] ?? STATUS.PENDING!;
            return (
              <li key={order.id} className="bg-card p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h2 className="min-w-0 flex-1 text-sm font-semibold">
                    <Link href={`/my/orders/${order.id}`} className="hover:text-primary">
                      {order.description}
                    </Link>
                  </h2>
                  <p className="num text-base font-medium">
                    {formatPrice(agorotToShekels(order.amountAgorot))}
                  </p>
                </div>

                <p className="mt-1 text-xs text-muted-foreground">
                  הזמנה <span className="num">{order.number}</span> ·{" "}
                  <span className={cn(status.className)}>{status.label}</span> ·{" "}
                  {timeAgo(order.createdAt.toISOString())}
                  {order.invoice ? (
                    <>
                      {" · "}
                      <Link
                        href={`/my/orders/${order.id}/invoice`}
                        className="text-info underline-offset-4 hover:underline"
                      >
                        חשבונית <span className="num">{order.invoice.number}</span>
                      </Link>
                    </>
                  ) : null}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
