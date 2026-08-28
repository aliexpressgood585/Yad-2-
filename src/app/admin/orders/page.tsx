import type { Metadata } from "next";
import Link from "next/link";

import { OrderActions } from "@/components/admin/order-actions";
import { prisma } from "@/lib/db";
import { formatCount, formatPrice } from "@/lib/format";
import { agorotToShekels } from "@/lib/plans";
import { paymentProvider } from "@/lib/payments";
import { cn, timeAgo } from "@/lib/utils";

export const metadata: Metadata = {
  title: "הזמנות",
  robots: { index: false, follow: false },
};

const STATUS: Record<string, { label: string; className: string }> = {
  PENDING: { label: "ממתינה", className: "text-primary" },
  PAID: { label: "שולמה", className: "text-info" },
  FAILED: { label: "נכשלה", className: "text-accent" },
  CANCELLED: { label: "בוטלה", className: "text-muted-foreground" },
  REFUNDED: { label: "זוכתה", className: "text-accent" },
};

export default async function AdminOrdersPage() {
  const provider = paymentProvider();

  const [orders, totals] = await Promise.all([
    prisma.order.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: {
        user: { select: { name: true, email: true } },
        invoice: { select: { number: true } },
      },
      take: 100,
    }),
    prisma.order.groupBy({
      by: ["status"],
      _count: true,
      _sum: { amountAgorot: true },
    }),
  ]);

  const paid = totals.find((t) => t.status === "PAID");
  const pending = totals.find((t) => t.status === "PENDING");

  return (
    <div className="space-y-6">
      <header>
        <h2 className="font-heading text-xl">הזמנות</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          ספק הסליקה הפעיל: {provider.label}
          {provider.isConfigured ? "" : " — לא מוגדר, ואי אפשר לפתוח הזמנות חדשות"}
        </p>
      </header>

      <dl className="grid gap-px border border-border bg-border sm:grid-cols-2">
        <div className="bg-card p-4">
          <dt className="text-xs text-muted-foreground">שולם</dt>
          {/*
            * `free: "₪ 0"` ולא ברירת המחדל: `formatPrice` מציג 0 כ"חינם",
            * וזה נכון למחיר מודעה ושגוי לגמרי לסכום בהנהלת חשבונות —
            * "שולם: חינם" אינו אומר כלום.
            */}
          <dd className="num mt-1 font-heading text-2xl text-info">
            {formatPrice(agorotToShekels(paid?._sum.amountAgorot ?? 0), { free: "₪\u202F0" })}
          </dd>
          <p className="num mt-1 text-xs text-muted-foreground">
            {formatCount(paid?._count ?? 0)} הזמנות
          </p>
        </div>
        <div className="bg-card p-4">
          <dt className="text-xs text-muted-foreground">ממתין לאישור</dt>
          <dd className="num mt-1 font-heading text-2xl text-primary">
            {formatPrice(agorotToShekels(pending?._sum.amountAgorot ?? 0), { free: "₪\u202F0" })}
          </dd>
          <p className="num mt-1 text-xs text-muted-foreground">
            {formatCount(pending?._count ?? 0)} הזמנות
          </p>
        </div>
      </dl>

      {orders.length === 0 ? (
        <p className="border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          אין הזמנות.
        </p>
      ) : (
        <ul className="flex flex-col gap-px bg-border">
          {orders.map((order) => {
            const status = STATUS[order.status] ?? STATUS.PENDING!;
            return (
              <li key={order.id} className="bg-card p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h3 className="min-w-0 flex-1 text-sm font-semibold">{order.description}</h3>
                  <p className="num text-base font-medium">
                    {formatPrice(agorotToShekels(order.amountAgorot))}
                  </p>
                </div>

                <p className="mt-1 text-xs text-muted-foreground">
                  הזמנה <span className="num">{order.number}</span> ·{" "}
                  <span className={cn(status.className)}>{status.label}</span> ·{" "}
                  {order.user.name}
                  {order.user.email ? (
                    <span dir="ltr"> ({order.user.email})</span>
                  ) : null}{" "}
                  · {timeAgo(order.createdAt.toISOString())}
                  {order.invoice ? (
                    <>
                      {" · חשבונית "}
                      <span className="num">{order.invoice.number}</span>
                    </>
                  ) : null}
                  {order.providerRef ? (
                    <>
                      {" · אסמכתה "}
                      <span className="num">{order.providerRef}</span>
                    </>
                  ) : null}
                </p>

                {order.listingId ? (
                  <p className="mt-1 text-xs">
                    <Link
                      href={`/admin/listings?q=${order.listingId}`}
                      className="text-info underline-offset-4 hover:underline"
                    >
                      המודעה בניהול
                    </Link>
                  </p>
                ) : null}

                <div className="mt-3">
                  <OrderActions orderId={order.id} status={order.status} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
