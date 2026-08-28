"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * מחליף בין שתי הפנים.
 *
 * אין כאן "לפי המערכת": פנים המכשיר היא ברירת המחדל של האתר ואינה
 * נגזרת מהעדפת מערכת ההפעלה (ראה DECISIONS.md §37). מי שרוצה את פנים
 * היום בוחר בה, והבחירה נשמרת.
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="בחירת ערכת צבעים">
          {/* עד שהרכיב נטען בצד לקוח מציגים אייקון קבוע כדי למנוע אי-התאמת hydration */}
          {!mounted || theme !== "light" ? <Moon aria-hidden /> : <Sun aria-hidden />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          <Moon aria-hidden /> פנים המכשיר
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("light")}>
          <Sun aria-hidden /> פנים היום
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
