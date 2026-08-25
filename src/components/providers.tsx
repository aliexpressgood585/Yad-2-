"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";

import { TooltipProvider } from "@/components/ui/misc";

export function Providers({ children }: { children: React.ReactNode }) {
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
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider
          attribute="class"
          /*
           * בהיר הוא ברירת המחדל, לא `system`.
           *
           * רוב המשתמשים בלוח מודעות ישראלי הם בנייד באור יום, ושם
           * חוגה כהה היא מסך שקשה לקרוא.
           *
           * **מה שזה אומר בפועל:** מבקר ראשון מקבל בהיר גם אם המכשיר
           * שלו מוגדר כהה. `enableSystem` אינו משנה את זה — הוא רק
           * הופך את "לפי המערכת" לאפשרות שאפשר לבחור בה בתפריט,
           * ו-`defaultTheme` הוא מה שקובע כשאין העדפה שמורה.
           *
           * ההערה כאן טענה בעבר את ההפך, ונמדד שלא: דפדפן עם
           * `prefers-color-scheme: dark` קיבל דף בהיר. ההתנהגות היא
           * ההחלטה; רק התיאור היה שגוי.
           */
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <TooltipProvider delayDuration={300}>
            {children}
            <Toaster
              position="bottom-center"
              dir="rtl"
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
  );
}
