import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatPrice } from "@/lib/format";
import { agorotToShekels } from "@/lib/plans";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "חשבונית",
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ id: string }> };

/**
 * חשבונית מס / קבלה.
 *
 * ## הכול נקרא מ-`Invoice` ולא מ-`User`
 *
 * שם הלקוח, הדוא"ל, הסכום ושיעור המע"מ הועתקו לשורת החשבונית ברגע
 * ההנפקה. חשבונית היא מסמך של רגע מסוים, ולקוח ששינה את שמו בפרופיל
 * אינו אמור לשנות מסמך שכבר הונפק — וגם שינוי בשיעור המע"מ אינו
 * משנה חשבוניות ישנות.
 *
 * ## מה שאין כאן, ולמה
 *
 * **מספר הקצאה של רשות המסים** (חוק חשבוניות ישראל). הוא מונפק בקריאה
 * מקוונת למערכת של רשות המסים ודורש הרשאה ואישור, ואין דרך לייצר אותו
 * מקומית. חשבונית שהייתה מציגה מספר מומצא במקום שלו היא מסמך מזויף,
 * לא מסמך חסר. מתועד ב-GROWTH.md סעיף F.
 */
export default async function InvoicePage({ params }: Props) {
  const { id } = await params;
  const session = await auth();

  const order = await prisma.order.findFirst({
    where: { id, userId: session!.user.id },
    include: { invoice: true },
  });
  if (!order?.invoice) notFound();

  const invoice = order.invoice;
  const net = invoice.amountAgorot - invoice.vatAgorot;

  return (
    <article className="mx-auto max-w-2xl border border-border bg-card p-6 print:border-0 print:p-0">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
        <div>
          <p className="font-heading text-xl">{SITE.name}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{SITE.url}</p>
        </div>
        <div className="text-end">
          <h1 className="font-heading text-lg">חשבונית מס / קבלה</h1>
          <p className="num mt-0.5 text-sm">{invoice.number}</p>
          <p className="num mt-0.5 text-xs text-muted-foreground">
            {invoice.issuedAt.toLocaleDateString("he-IL")}
          </p>
        </div>
      </header>

      <section className="border-b border-border py-4">
        <h2 className="text-xs text-muted-foreground">לכבוד</h2>
        <p className="mt-1 text-sm font-medium">{invoice.customerName}</p>
        {invoice.customerEmail ? (
          <p className="text-sm text-muted-foreground" dir="ltr">
            {invoice.customerEmail}
          </p>
        ) : null}
        {invoice.customerTaxId ? (
          <p className="num text-sm text-muted-foreground">ח.פ. {invoice.customerTaxId}</p>
        ) : null}
      </section>

      <table className="w-full py-4 text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            <th scope="col" className="py-2 text-start font-medium">
              תיאור
            </th>
            <th scope="col" className="py-2 text-end font-medium">
              סכום
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="py-3">{order.description}</td>
            <td className="num py-3 text-end">{formatPrice(agorotToShekels(net))}</td>
          </tr>
        </tbody>
        <tfoot className="border-t border-border">
          <tr>
            <td className="py-2 text-muted-foreground">
              מע&quot;מ <span className="num">{Math.round(invoice.vatRate * 100)}%</span>
            </td>
            <td className="num py-2 text-end">
              {formatPrice(agorotToShekels(invoice.vatAgorot))}
            </td>
          </tr>
          <tr className="border-t border-border">
            <td className="py-2 font-semibold">סה&quot;כ לתשלום</td>
            <td className="num py-2 text-end font-semibold">
              {formatPrice(agorotToShekels(invoice.amountAgorot))}
            </td>
          </tr>
        </tfoot>
      </table>

      <footer className="border-t border-border pt-4 text-xs text-muted-foreground">
        <p>
          שולם ב-
          <span className="num">
            {(order.paidAt ?? invoice.issuedAt).toLocaleDateString("he-IL")}
          </span>
          {order.providerRef ? (
            <>
              {" · אסמכתה "}
              <span className="num">{order.providerRef}</span>
            </>
          ) : null}
        </p>
        <p className="mt-2">
          המסמך אינו כולל מספר הקצאה של רשות המסים. לצורכי דיווח יש לפנות אלינו.
        </p>
      </footer>
    </article>
  );
}
