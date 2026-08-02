"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Rocket } from "lucide-react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/misc";
import { Label } from "@/components/ui/label";
import { BOOST_PACKAGES } from "@/lib/site";
import { truncate } from "@/lib/utils";
import { formatPrice } from "@/lib/format";

/**
 * בחירת חבילת קידום למודעה.
 * אין כאן חיוב אמיתי — הזמנת הקידום נרשמת והמודעה מסומנת כמקודמת,
 * כך שניתן לחבר ספק סליקה בהמשך בלי לשנות את הזרימה.
 */
export function BoostDialog({
  listingId,
  listingTitle,
  open,
  onOpenChange,
}: {
  listingId: string;
  listingTitle: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const [kind, setKind] = React.useState(BOOST_PACKAGES[0]!.kind);
  const [saving, setSaving] = React.useState(false);

  async function submit() {
    setSaving(true);
    try {
      const res = await fetch("/api/boosts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ listingId, kind }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "הפעלת הקידום נכשלה");
        return;
      }
      toast.success("הקידום הופעל. המודעה תבלוט בתוצאות.");
      onOpenChange(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="size-5 text-accent" aria-hidden />
            קידום מודעה
          </DialogTitle>
          <DialogDescription>{truncate(listingTitle, 70)}</DialogDescription>
        </DialogHeader>

        <RadioGroup value={kind} onValueChange={(v) => setKind(v as typeof kind)} className="py-2">
          {BOOST_PACKAGES.map((pkg) => (
            <label
              key={pkg.kind}
              htmlFor={`boost-${pkg.kind}`}
              className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary-soft/40"
            >
              <RadioGroupItem value={pkg.kind} id={`boost-${pkg.kind}`} className="mt-0.5" />
              <div className="flex-1">
                <Label htmlFor={`boost-${pkg.kind}`} className="cursor-pointer font-semibold">
                  {pkg.name}
                </Label>
                <p className="text-xs text-muted-foreground">{pkg.description}</p>
              </div>
              <div className="text-end">
                <p className="num font-heading font-bold">{formatPrice(pkg.priceIls)}</p>
                <p className="num text-xs text-muted-foreground">{pkg.days} ימים</p>
              </div>
            </label>
          ))}
        </RadioGroup>

        <DialogFooter>
          <Button onClick={submit} loading={saving}>
            הפעלת הקידום
          </Button>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            ביטול
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
