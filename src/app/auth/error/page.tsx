import Link from "next/link";
import type { Metadata } from "next";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "שגיאת התחברות",
  robots: { index: false, follow: false },
};

const MESSAGES: Record<string, string> = {
  Configuration: "שירות ההתחברות אינו מוגדר כראוי. נסו שוב מאוחר יותר.",
  AccessDenied: "הגישה נדחתה. ייתכן שהחשבון חסום.",
  Verification: "קישור האימות פג תוקף או שכבר נעשה בו שימוש.",
  OAuthAccountNotLinked:
    "כתובת האימייל הזו כבר רשומה בדרך התחברות אחרת. התחברו באותה דרך שבה נרשמתם.",
};

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const message =
    (error && MESSAGES[error]) ?? "אירעה שגיאה בתהליך ההתחברות. נסו שוב.";

  return (
    <Card>
      <CardHeader>
        <div className="mx-auto grid size-12 place-items-center rounded-full bg-destructive/10">
          <AlertTriangle className="size-6 text-destructive" aria-hidden />
        </div>
        <CardTitle className="text-center">ההתחברות נכשלה</CardTitle>
        <CardDescription className="text-center">{message}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <Button asChild size="lg">
          <Link href="/auth/login">חזרה למסך ההתחברות</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/">לדף הבית</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
