import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Bell, Heart, PlusCircle } from "lucide-react";

import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "ברוכים הבאים",
  robots: { index: false, follow: false },
};

const STEPS = [
  {
    icon: PlusCircle,
    title: "פרסמו מודעה",
    body: "ארבעה שלבים קצרים, תמונות בגרירה, והמודעה באוויר.",
    href: "/publish",
    cta: "לפרסום מודעה",
  },
  {
    icon: Heart,
    title: "שמרו מועדפים",
    body: "כל מה שאהבתם במקום אחד — זמין גם כשאתם לא מחוברים לרשת.",
    href: "/",
    cta: "לעיון במודעות",
  },
  {
    icon: Bell,
    title: "הפעילו התראות",
    body: "שמרו חיפוש וקבלו התראה ברגע שמתפרסמת מודעה שמתאימה לכם.",
    href: "/my/searches",
    cta: "לחיפושים שמורים",
  },
];

export default async function WelcomePage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");

  return (
    <div className="w-full space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>שמחים שהצטרפת, {session.user.name}!</CardTitle>
          <CardDescription>
            שלושה דברים שכדאי לעשות עכשיו כדי להפיק מהלוח את המקסימום.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {STEPS.map((s) => (
            <div key={s.title} className="flex items-start gap-3 rounded-lg border p-3">
              <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-md bg-primary-soft text-primary">
                <s.icon className="size-5" aria-hidden />
              </span>
              <div className="flex-1">
                <h2 className="text-sm font-bold">{s.title}</h2>
                <p className="text-sm text-muted-foreground">{s.body}</p>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link href={s.href}>{s.cta}</Link>
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
