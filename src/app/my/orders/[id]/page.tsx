import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatPrice } from "@/lib/format";
import { agorotToShekels } from "@/lib/plans";
import { paymentProvider } from "@/lib/payments";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "הזמנה",
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ cancelled?: string }> };

/**
 * דף ההזמנה.
 *
 * כשההזמנה ממתינה לתשלום, הוראות התשלום מיוצרות מחדש מהספק בכל טעינה
 * ואינן נשמרות: פרטי חשבון בנק שנשמרו על הזמנה משנה שעברה הם בדיוק
 * המקום שממנו כסף הולך לחשבון שנסגר.
 */
export default async function OrderPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { cancelled } = await searchParams;

  const session = await auth();
  const order = await prisma.order.findFirst({
    where: { id, userId: session!.user.id },
    include: { invoice: true, user: { select: { name: true, email: true, phone: true } } },
  });
  if (!order) notFound();

  const provider = paymentProvider();
  const instructions =
    order.status === "PENDING" && provider.isConfigured && provider.id === order.provider
      ? await provider
          .createCheckout({
            order,
            customer: order.user,
            returnUrl: `${SITE.url}/my/orders/${order.id}`,
            cancelUrl: `${SITE.url}/my/orders/${order.id}?cancelled=1`,
            callbackUrl: `${SITE.url}/api/payments/callback/${provider.id}`,
          })
          .catch(() => null)
      : null;

  return (
    <div className="space-y-5">
      <header>
        <p className="text-xs text-muted-foreground">
          הזמנה <span className="num">{order.number}</span>
        </p>
        <h1 className="mt-1 font-heading text-2xl">{order.description}</h1>
      </header>

      {cancelled ? (
        <p className="border border-border bg-muted p-3 text-sm">
          התשלום בוטל. ההזמנה נשארה פתוחה, ואפשר לשלם עליה בכל עת.
        </p>
      ) : null}

      <dl className="grid gap-px border border-border bg-border sm:grid-cols-3">
        <div className="bg-card p-4">
          <dt className="text-xs text-muted-foreground">לתשלום</dt>
          <dd className="num mt-1 font-heading text-xl">
            {formatPrice(agorotToShekels(order.amountAgorot))}
          </dd>
          <p className="num mt-1 text-xs text-muted-foreground">
            כולל מע&quot;מ {formatPrice(agorotToShekels(order.vatAgorot))}
          </p>
        </div>
        <div className="bg-card p-4">
          <dt className="text-xs text-muted-foreground">מצב</dt>
          <dd className="mt-1 text-sm font-medium">
            {order.status === "PAID"
              ? "שולמה"
              : order.status === "PENDING"
                ? "ממתינה לתשלום"
                : order.status === "REFUNDED"
                  ? "זוכתה"
                  : order.status === "FAILED"
                    ? "נכשלה"
                    : "בוטלה"}
          </dd>
          {order.failureReason ? (
            <p className="mt-1 text-xs text-accent">{order.failureReason}</p>
          ) : null}
        </div>
        <div className="bg-card p-4">
          <dt className="text-xs text-muted-foreground">חשבונית</dt>
          <dd className="mt-1 text-sm">
            {order.invoice ? (
              <Link
                href={`/my/orders/${order.id}/invoice`}
                className="num text-info underline-offset-4 hover:underline"
              >
                {order.invoice.number}
              </Link>
            ) : (
              <span className="text-muted-foreground">תונפק עם התשלום</span>
            )}
          </dd>
        </div>
      </dl>

      {instructions?.mode === "instructions" ? (
        <section className="border border-primary bg-card p-4">
          <h2 className="font-heading text-base">{instructions.title}</h2>
          <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-relaxed">
            {instructions.body}
          </pre>
        </section>
      ) : null}

      {instructions?.mode === "redirect" ? (
        <a
          href={instructions.url}
          className="inline-flex h-10 items-center bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          מעבר לתשלום
        </a>
      ) : null}

      {order.status === "PENDING" && !instructions ? (
        <p className="border border-border bg-muted p-3 text-sm text-muted-foreground">
          התשלום אינו זמין כרגע. ההזמנה נשמרה, ואפשר לפנות אלינו כדי להשלים אותה.
        </p>
      ) : null}
    </div>
  );
}
