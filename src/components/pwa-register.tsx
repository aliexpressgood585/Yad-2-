"use client";

import * as React from "react";
import { Download, X } from "lucide-react";

import { Button } from "@/components/ui/button";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "shnatot-install-dismissed";

/**
 * רושם את ה-Service Worker ומציג הצעת התקנה של האפליקציה.
 * ההצעה נעלמת לצמיתות אם המשתמש סגר אותה.
 */
export function PwaRegister() {
  const [prompt, setPrompt] = React.useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // ההרשמה נדחית לאחר הטעינה כדי לא להתחרות על רוחב פס עם ה-LCP
    const register = () => {
      void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  React.useEffect(() => {
    if (localStorage.getItem(DISMISS_KEY)) return;

    function onPrompt(e: Event) {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    }
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!visible || !prompt) return null;

  return (
    <div className="fixed inset-x-3 bottom-20 z-40 flex items-center gap-3 rounded-lg border border-border bg-card p-3 md:inset-x-auto md:bottom-4 md:end-4 md:max-w-sm">
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
        <Download className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium">התקנת האפליקציה</p>
        <p className="text-xs text-muted-foreground">
          גישה מהירה מהמסך הראשי, גם ללא חיבור לרשת.
        </p>
      </div>
      <Button
        size="sm"
        onClick={async () => {
          await prompt.prompt();
          await prompt.userChoice;
          setVisible(false);
        }}
      >
        התקנה
      </Button>
      <button
        type="button"
        aria-label="סגירה"
        onClick={() => {
          localStorage.setItem(DISMISS_KEY, "1");
          setVisible(false);
        }}
        className="grid size-7 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
