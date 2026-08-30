"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";

import { TooltipProvider } from "@/components/ui/misc";
import { LocaleProvider } from "@/i18n/client";
import { LOCALE_DIR, type Locale } from "@/i18n/config";

export function Providers({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return (
    <LocaleProvider locale={locale}>
      <SessionProvider>
      <QueryClientProvider client={queryClient}>
        {/*
         * פנים המכשיר היא ברירת המחדל, ואינה נגזרת מהעדפת מערכת ההפעלה.
         *
         * `enableSystem` היה מוסר את ההחלטה מהאתר: רוב המשתמשים במחשב
         * שולחני מגדירים מערכת בהירה, כלומר הפלטה שהמותג מוגדר בה —
         * גרפיט וענבר זרחני — לא הייתה מוצגת לאיש. פנים היום קיימת
         * במלואה ונבנתה מחדש לצורך ניגודיות, אבל היא בחירה מפורשת
         * במחליף הערכה ולא ברירת מחדל שקטה. ראה DECISIONS.md §37.
         */}
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <TooltipProvider delayDuration={300}>
            {children}
            <Toaster
              position="bottom-center"
              dir={LOCALE_DIR[locale]}
              richColors
              closeButton
              toastOptions={{
                classNames: {
                  toast: "font-sans text-sm",
                },
              }}
            />
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
      </SessionProvider>
    </LocaleProvider>
  );
}
