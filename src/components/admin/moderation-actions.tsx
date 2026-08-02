"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Ban, Check, MoreVertical, ShieldOff, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * פעולות מודרציה על מודעה ועל המפרסם.
 * כל פעולה נרשמת ב-AuditLog בשרת.
 */
export function ModerationActions({
  reportId,
  listingId,
  userId,
}: {
  reportId?: string;
  listingId: string;
  userId: string;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function call(
    url: string,
    body: Record<string, unknown>,
    successMessage: string,
    confirmText?: string,
  ) {
    if (confirmText && !window.confirm(confirmText)) return;
    setPending(true);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "הפעולה נכשלה");
        return;
      }
      toast.success(successMessage);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      {reportId ? (
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() =>
            void call("/api/admin/moderate", { reportId, action: "dismiss" }, "הדיווח נדחה")
          }
        >
          <Check aria-hidden />
          תקין
        </Button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() =>
            void call(
              "/api/admin/moderate",
              { listingId, action: "clear_flags" },
              "הסימונים נוקו",
            )
          }
        >
          <Check aria-hidden />
          תקין
        </Button>
      )}

      <Button
        variant="destructive"
        size="sm"
        disabled={pending}
        onClick={() =>
          void call(
            "/api/admin/moderate",
            { reportId, listingId, action: "ban_listing" },
            "המודעה הוסרה",
            "להסיר את המודעה מהאתר?",
          )
        }
      >
        <X aria-hidden />
        הסרה
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="פעולות נוספות">
            <MoreVertical aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() =>
              void call(
                "/api/admin/moderate",
                { listingId, action: "unban_listing" },
                "המודעה הוחזרה לאוויר",
              )
            }
          >
            <ShieldOff aria-hidden />
            החזרת המודעה לאוויר
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            destructive
            onClick={() =>
              void call(
                "/api/admin/moderate",
                { reportId, listingId, userId, action: "block_user" },
                "המשתמש נחסם וכל מודעותיו הוסרו",
                "לחסום את המשתמש ולהסיר את כל מודעותיו? הפעולה משמעותית.",
              )
            }
          >
            <Ban aria-hidden />
            חסימת המשתמש
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
