"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { BellPlus } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/misc";

const FREQUENCIES = [
  { value: "INSTANT", label: "מיידית", hint: "התראה על כל מודעה חדשה שמתאימה" },
  { value: "DAILY", label: "סיכום יומי", hint: "מייל אחד ביום עם כל החדשות" },
  { value: "WEEKLY", label: "סיכום שבועי", hint: "מייל אחד בשבוע" },
  { value: "OFF", label: "ללא התראות", hint: "רק שמירה לצפייה מאוחר יותר" },
];

/** שומר את החיפוש הנוכחי (כולל כל הפילטרים שב-URL) עם הגדרת תדירות התראה. */
export function SaveSearchButton({ defaultName }: { defaultName: string }) {
  const { status } = useSession();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState(defaultName);
  const [frequency, setFrequency] = React.useState("INSTANT");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => setName(defaultName), [defaultName]);

  async function save() {
    setSaving(true);
    try {
      const filters: Record<string, string> = { path: pathname };
      searchParams.forEach((v, k) => {
        filters[k] = v;
      });

      const res = await fetch("/api/saved-searches", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, filters, frequency }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? "שמירת החיפוש נכשלה");
        return;
      }
      toast.success("החיפוש נשמר. נעדכן אותך על מודעות חדשות.");
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  if (status !== "authenticated") return null;

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} className="hidden sm:inline-flex">
        <BellPlus aria-hidden />
        שמירת חיפוש
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>שמירת החיפוש</DialogTitle>
            <DialogDescription>
              נשמור את כל הפילטרים הנוכחיים ונעדכן אותך כשמתפרסמות מודעות מתאימות.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="search-name" required>
                שם החיפוש
              </Label>
              <Input
                id="search-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
              />
            </div>

            <fieldset className="space-y-2">
              <legend className="mb-1 text-sm font-medium">תדירות ההתראות</legend>
              <RadioGroup value={frequency} onValueChange={setFrequency}>
                {FREQUENCIES.map((f) => (
                  <div key={f.value} className="flex items-start gap-2.5">
                    <RadioGroupItem value={f.value} id={`freq-${f.value}`} className="mt-0.5" />
                    <Label htmlFor={`freq-${f.value}`} className="cursor-pointer font-normal">
                      {f.label}
                      <span className="block text-xs text-muted-foreground">{f.hint}</span>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </fieldset>
          </div>

          <DialogFooter>
            <Button onClick={save} loading={saving} disabled={name.trim().length < 2}>
              שמירה
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
