"use client";

import * as React from "react";
import { Flag } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/misc";

const REASONS = [
  { value: "FRAUD", label: "חשד להונאה", hint: "בקשה לתשלום מראש, מחיר לא הגיוני" },
  { value: "SPAM", label: "ספאם או פרסומת", hint: "המודעה אינה מציעה מוצר או שירות אמיתי" },
  { value: "OFFENSIVE", label: "תוכן פוגעני", hint: "שפה בוטה, גזענות או תוכן לא הולם" },
  { value: "DUPLICATE", label: "מודעה כפולה", hint: "אותה מודעה פורסמה כמה פעמים" },
  { value: "WRONG_CATEGORY", label: "קטגוריה שגויה", hint: "המודעה לא שייכת לקטגוריה הזו" },
  { value: "SOLD_ALREADY", label: "הפריט כבר נמכר", hint: "המוכר אישר שהפריט לא זמין" },
  { value: "OTHER", label: "אחר", hint: "פרטו בשדה למטה" },
];

export function ReportDialog({ listingId }: { listingId: string }) {
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("FRAUD");
  const [details, setDetails] = React.useState("");
  const [sending, setSending] = React.useState(false);

  async function submit() {
    setSending(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ listingId, reason, details }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "שליחת הדיווח נכשלה");
        return;
      }
      toast.success("הדיווח התקבל. הצוות שלנו יבדוק אותו בהקדם.");
      setOpen(false);
      setDetails("");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Flag aria-hidden />
        דיווח על המודעה
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>דיווח על מודעה</DialogTitle>
            <DialogDescription>
              הדיווח נשלח לצוות המודרציה ונבדק ידנית. פרטי המדווח אינם נחשפים למפרסם.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <fieldset>
              <legend className="mb-2 text-sm font-medium">סיבת הדיווח</legend>
              <RadioGroup value={reason} onValueChange={setReason}>
                {REASONS.map((r) => (
                  <div key={r.value} className="flex items-start gap-2.5">
                    <RadioGroupItem value={r.value} id={`reason-${r.value}`} className="mt-0.5" />
                    <Label htmlFor={`reason-${r.value}`} className="cursor-pointer font-normal">
                      {r.label}
                      <span className="block text-xs text-muted-foreground">{r.hint}</span>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </fieldset>

            <div className="space-y-1.5">
              <Label htmlFor="report-details">פרטים נוספים (אופציונלי)</Label>
              <Textarea
                id="report-details"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                rows={3}
                maxLength={1000}
                placeholder="מה בדיוק הבעיה במודעה?"
              />
            </div>
          </div>

          <DialogFooter>
            <Button onClick={submit} loading={sending} variant="destructive">
              שליחת הדיווח
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              ביטול
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
