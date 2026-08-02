"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import { AlertCircle, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GoogleButton } from "@/components/auth/google-button";
import { OtpFields } from "@/components/auth/otp-fields";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/my";
  const urlError = params.get("error");

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(
    urlError ? "ההתחברות נכשלה. נסו שוב או בחרו דרך התחברות אחרת." : null,
  );

  async function onPasswordSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);

    const res = await signIn("password", {
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
      redirect: false,
    });
    setLoading(false);

    if (res?.error) {
      setError("האימייל או הסיסמה שגויים.");
      return;
    }
    toast.success("התחברת בהצלחה");
    router.push(callbackUrl);
    router.refresh();
  }

  async function onOtpVerified(phone: string, code: string) {
    setError(null);
    const res = await signIn("otp", { phone, code, redirect: false });
    if (res?.error) {
      setError("הקוד שגוי או שפג תוקפו.");
      return false;
    }
    toast.success("התחברת בהצלחה");
    router.push(callbackUrl);
    router.refresh();
    return true;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>התחברות</CardTitle>
        <CardDescription>
          עדיין אין לך חשבון?{" "}
          <Link href="/auth/register" className="font-medium text-primary hover:underline">
            הרשמה חינם
          </Link>
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {error ? (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            {error}
          </p>
        ) : null}

        <Tabs defaultValue="otp">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="otp">קוד ב-SMS</TabsTrigger>
            <TabsTrigger value="password">אימייל וסיסמה</TabsTrigger>
          </TabsList>

          <TabsContent value="otp">
            <OtpFields purpose="login" onVerify={onOtpVerified} />
          </TabsContent>

          <TabsContent value="password">
            <form onSubmit={onPasswordSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" required>
                  אימייל
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  dir="ltr"
                  placeholder="you@example.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password" required>
                  סיסמה
                </Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  dir="ltr"
                />
              </div>
              <Button type="submit" className="w-full" size="lg" loading={loading}>
                התחברות
                <ArrowRight className="rotate-180" aria-hidden />
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        <div className="relative py-1 text-center">
          <span className="relative z-10 bg-card px-3 text-xs text-muted-foreground">
            או
          </span>
          <span className="absolute inset-x-0 top-1/2 h-px bg-border" aria-hidden />
        </div>

        <GoogleButton callbackUrl={callbackUrl} />
      </CardContent>
    </Card>
  );
}
