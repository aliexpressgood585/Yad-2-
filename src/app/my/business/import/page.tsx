import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ImportPanel } from "@/components/my/import-panel";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { REQUIRED_COLUMNS } from "@/lib/dealer-import";

export const metadata: Metadata = { title: "ייבוא מרוכז" };
export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/login?callbackUrl=/my/business/import");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { businessName: true, verifiedAt: true },
  });

  if (!user?.businessName) redirect("/my/business");

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <Link href="/my/business" className="text-sm text-info underline underline-offset-4">
          ← לוח הסוחר
        </Link>
        <h1 className="font-heading text-xl font-bold">ייבוא מרוכז</h1>
        <p className="max-w-prose text-muted-foreground">
          העלאת מלאי שלם מקובץ CSV. הקובץ נבדק לפני שנוצרת ולו מודעה אחת, ושורה
          שגויה לא מונעת את ייבוא השאר.
        </p>
      </header>

      {!user.verifiedAt ? (
        <p className="border-s-2 border-accent bg-accent/10 p-3 text-sm">
          יש לאמת מספר טלפון לפני ייבוא מודעות.{" "}
          <Link href="/my/profile" className="underline underline-offset-4">
            אימות בפרופיל
          </Link>
        </p>
      ) : null}

      <section className="flex flex-col gap-3 border border-border bg-card p-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          מבנה הקובץ
        </h2>
        <p className="text-sm">
          שורה ראשונה היא שמות העמודות. עמודות חובה:{" "}
          {REQUIRED_COLUMNS.map((c) => (
            <code key={c} className="mx-0.5 bg-secondary px-1 py-0.5 text-xs">
              {c}
            </code>
          ))}
        </p>
        <p className="text-sm text-muted-foreground">
          <code className="bg-secondary px-1 py-0.5 text-xs">קטגוריה</code> מקבלת את
          המזהה הלועזי של הקטגוריה (למשל <code className="text-xs">private-cars</code>).
          כל עמודה נוספת נקראת כמאפיין דינמי — יצרן, שנה, קילומטראז&apos; וכן הלאה.
        </p>
      </section>

      <ImportPanel />
    </div>
  );
}
