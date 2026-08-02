"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { OtpFields } from "@/components/auth/otp-fields";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * חסימת פרסום ראשון עד לאימות טלפון.
 * זהו קו ההגנה המרכזי מול ספאם ומודעות פיקטיביות.
 */
export function VerifyPhoneGate({
  defaultPhone,
  onVerified,
}: {
  defaultPhone: string;
  onVerified: (phone: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const { update } = useSession();

  async function verify(phone: string, code: string) {
    const res = await fetch("/api/auth/otp", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone, code }),
    });
    const data = await res.json();

    if (!res.ok) {
      toast.error(data.error ?? "האימות נכשל");
      return false;
    }

    // רענון הטוקן כדי ש-phoneVerified יתעדכן גם בשרת
    await update({ phone: data.phone, phoneVerified: true });
    toast.success("הטלפון אומת. אפשר לפרסם!");
    onVerified(data.phone);
    setOpen(false);
    return true;
  }

  return (
    <>
      <aside className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-warning/40 bg-warning/10 p-3.5">
        <ShieldAlert className="size-5 shrink-0 text-warning" aria-hidden />
        <div className="flex-1 text-sm">
          <p className="font-bold">נדרש אימות טלפון לפני הפרסום</p>
          <p className="text-muted-foreground">
            האימות חד-פעמי, לוקח 20 שניות, ומגן על הלוח ממודעות פיקטיביות.
          </p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>
          אימות עכשיו
        </Button>
      </aside>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>אימות מספר טלפון</DialogTitle>
            <DialogDescription>
              נשלח קוד בן 6 ספרות ב-SMS. המספר לא יוצג בפומבי — הוא נחשף רק כשמתעניין לוחץ
              על &quot;הצגת מספר&quot;.
            </DialogDescription>
          </DialogHeader>
          <div className="pt-2">
            <OtpFields purpose="verify" initialPhone={defaultPhone} onVerify={verify} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
