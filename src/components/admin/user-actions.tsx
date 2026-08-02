"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Ban, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function UserActions({
  userId,
  isBlocked,
  role,
}: {
  userId: string;
  isBlocked: boolean;
  role: string;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function toggle() {
    const action = isBlocked ? "unblock_user" : "block_user";
    if (
      !isBlocked &&
      !window.confirm("לחסום את המשתמש? כל מודעותיו יוסרו מהאתר.")
    ) {
      return;
    }

    setPending(true);
    try {
      const res = await fetch("/api/admin/moderate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, userId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "הפעולה נכשלה");
        return;
      }
      toast.success(isBlocked ? "החסימה הוסרה" : "המשתמש נחסם");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  // מנהלים אינם ניתנים לחסימה מהממשק — מונע נעילה עצמית של המערכת
  if (role === "ADMIN") {
    return <span className="text-xs text-muted-foreground">חשבון מנהל</span>;
  }

  return (
    <Button
      variant={isBlocked ? "outline" : "destructive"}
      size="sm"
      loading={pending}
      onClick={() => void toggle()}
    >
      {isBlocked ? <ShieldCheck aria-hidden /> : <Ban aria-hidden />}
      {isBlocked ? "הסרת חסימה" : "חסימה"}
    </Button>
  );
}
