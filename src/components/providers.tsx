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
           * חוגה כהה היא מסך שקשה לקרוא. `enableSystem` נשאר דלוק
           * ולכן מי שהגדיר העדפה כהה במכשיר עדיין מקבל אותה בביקור
           * הראשון — ההבדל הוא במה שקורה כשאין העדפה.
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
