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
 *
 * **הכפתור פותח הזמנה, לא קידום.** הקידום מופעל רק כשההזמנה משולמת
 * בפועל (`fulfillOrder`), ולכן אין כאן מסלול שבו מישהו מקבל קידום בלי
 * לשלם. כשאין ספק סליקה מוגדר בשרת, הכפתור אינו מוצג כלל ובמקומו
 * מופיע הסבר — עדיף להגיד שאי אפשר לשלם מאשר לקחת לחיצה ולהיכשל.
 */
export function BoostDialog({
  listingId,
  listingTitle,
  open,
  onOpenChange,
  paymentsEnabled,
}: {
  listingId: string;
  listingTitle: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  paymentsEnabled: boolean;
}) {
  const router = useRouter();
  const [kind, setKind] = React.useState(BOOST_PACKAGES[0]!.kind);
  const [saving, setSaving] = React.useState(false);

  async function submit() {
    setSaving(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: "BOOST", listingId, boostKind: kind }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "פתיחת ההזמנה נכשלה");
        return;
      }

      onOpenChange(false);
      // דף ההזמנה מציג את מה שהספק החזיר — הפניה או הוראות תשלום
      if (data.checkout?.mode === "redirect") {
        window.location.href = data.checkout.url;
        return;
      }
      router.push(`/my/orders/${data.orderId}`);
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

        {!paymentsEnabled ? (
          <p className="border border-border bg-muted p-3 text-sm text-muted-foreground">
            התשלום אינו זמין כרגע ולכן אי אפשר להזמין קידום. אפשר לפנות אלינו
            ונעדכן ברגע שהוא ייפתח.
          </p>
        ) : null}

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
          <Button onClick={submit} loading={saving} disabled={!paymentsEnabled}>
            מעבר לתשלום
          </Button>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            ביטול
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
