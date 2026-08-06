"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { AlertCircle } from "lucide-react";
import type { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GoogleButton } from "@/components/auth/google-button";
import { registerSchema } from "@/lib/validators";

type FormValues = z.input<typeof registerSchema>;

export function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/my";
  const [serverError, setServerError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "", phone: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...values, phone: values.phone || undefined }),
    });
    const data = await res.json();

    if (!res.ok) {
      setServerError(data.error ?? "ההרשמה נכשלה");
      return;
    }

    const signInRes = await signIn("password", {
      email: values.email,
      password: values.password,
      redirect: false,
    });
    if (signInRes?.error) {
      toast.success("החשבון נוצר. אפשר להתחבר עכשיו.");
      router.push("/auth/login");
      return;
    }
    toast.success("ברוכים הבאים ללוח!");
    router.push(callbackUrl);
    router.refresh();
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>פתיחת חשבון</CardTitle>
        <CardDescription>
          כבר יש לך חשבון?{" "}
          <Link href="/auth/login" className="font-medium text-primary hover:underline">
            להתחברות
          </Link>
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {serverError ? (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            {serverError}
          </p>
        ) : null}

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Field
            id="name"
            label="שם מלא"
            required
            error={errors.name?.message}
            inputProps={{ autoComplete: "name", ...register("name") }}
          />
          <Field
            id="email"
            label="אימייל"
            required
            error={errors.email?.message}
            inputProps={{
              type: "email",
              dir: "ltr",
              autoComplete: "email",
              placeholder: "you@example.com",
              ...register("email"),
            }}
          />
          <Field
            id="phone"
            label="טלפון נייד (אופציונלי)"
            hint="נדרש לפרסום מודעות. אפשר להוסיף גם בהמשך."
            error={errors.phone?.message}
            inputProps={{
              type: "tel",
              dir: "ltr",
              autoComplete: "tel",
              placeholder: "050-000-0000",
              ...register("phone"),
            }}
          />
          <Field
            id="password"
            label="סיסמה"
            required
            hint="לפחות 8 תווים, אותיות וספרות."
            error={errors.password?.message}
            inputProps={{
              type: "password",
              dir: "ltr",
              autoComplete: "new-password",
              ...register("password"),
            }}
          />

          <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
            יצירת חשבון
          </Button>
        </form>

        <div className="relative py-1 text-center">
          <span className="relative z-10 bg-card px-3 text-xs text-muted-foreground">או</span>
          <span className="absolute inset-x-0 top-1/2 h-px bg-border" aria-hidden />
        </div>

        <GoogleButton callbackUrl={callbackUrl} />
      </CardContent>
    </Card>
  );
}

function Field({
  id,
  label,
  required,
  hint,
  error,
  inputProps,
}: {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  inputProps: React.ComponentProps<typeof Input>;
}) {
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      <Input
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy || undefined}
        {...inputProps}
      />
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
