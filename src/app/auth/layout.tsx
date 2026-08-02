import Link from "next/link";

import { Logo } from "@/components/brand/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="container flex min-h-[70vh] flex-col items-center justify-center py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <Logo showWordmark={false} />
          <p className="text-sm text-muted-foreground">
            הלוח שמכבד את הזמן שלך
          </p>
        </div>
        {children}
        <p className="mt-6 text-center text-xs text-muted-foreground">
          בהמשך התהליך אתם מאשרים את{" "}
          <Link href="/terms" className="underline hover:text-foreground">
            תנאי השימוש
          </Link>{" "}
          ואת{" "}
          <Link href="/privacy" className="underline hover:text-foreground">
            מדיניות הפרטיות
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
