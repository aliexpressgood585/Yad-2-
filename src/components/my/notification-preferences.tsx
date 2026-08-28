"use client";

import * as React from "react";
import { toast } from "sonner";

import { Switch } from "@/components/ui/checkbox";

type Prefs = {
  notifyEmail: boolean;
  notifyPush: boolean;
  quietHours: boolean;
  monthlyReport: boolean;
};

const ROWS: { key: keyof Prefs; label: string; hint: string }[] = [
  {
    key: "notifyPush",
    label: "התראות בדפדפן",
    hint: "התראה על המסך גם כשהלוח סגור. דורש אישור מהדפדפן.",
  },
  {
    key: "notifyEmail",
    label: 'עדכון מרוכז בדוא"ל',
    hint: "מייל אחד שמאגד את כל העדכונים, לא מייל לכל אירוע.",
  },
  {
    key: "quietHours",
    label: "שעות שקט",
    hint: "אין התראות בין 22:00 ל-07:00, ואין בשבת. מה שנצבר נשלח אחר כך.",
  },
  {
    key: "monthlyReport",
    label: "הדוח החודשי של מדד המחירים",
    hint: 'מה קרה למחירים ברכבים ובערים שאתם עוקבים אחריהם. נשלח ב-1 בחודש בדוא"ל.',
  },
];

/**
 * העדפות ההתראה.
 *
 * שינוי נשמר מיד ובלי כפתור "שמירה": מתג שדורש אישור נפרד גורם לאנשים
 * לחשוב שהם כיבו התראה כשלא כיבו. במקרה כישלון המתג חוזר למצבו הקודם
 * והמשתמש רואה שגיאה — עדיף מתג שקופץ אחורה מאשר מתג שמשקר.
 */
export function NotificationPreferences({ initial }: { initial: Prefs }) {
  const [prefs, setPrefs] = React.useState(initial);
  const [saving, setSaving] = React.useState<keyof Prefs | null>(null);

  async function update(key: keyof Prefs, value: boolean) {
    const previous = prefs[key];
    setPrefs((p) => ({ ...p, [key]: value }));
    setSaving(key);

    try {
      const res = await fetch("/api/profile/notifications", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
      if (!res.ok) throw new Error(await res.text());
    } catch {
      setPrefs((p) => ({ ...p, [key]: previous }));
      toast.error("לא הצלחנו לשמור את ההעדפה. נסו שוב בעוד רגע.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <section aria-labelledby="prefs-heading" className="border border-border bg-card p-4">
      <h2 id="prefs-heading" className="font-heading text-base">
        מה נשלח אליכם
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        התראות באתר נשמרות תמיד. ההגדרות כאן קובעות מה יוצא החוצה.
      </p>

      <ul className="mt-4 divide-y divide-border">
        {ROWS.map((row) => (
          <li key={row.key} className="flex items-start justify-between gap-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">{row.label}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{row.hint}</p>
            </div>
            <Switch
              checked={prefs[row.key]}
              disabled={saving === row.key}
              onCheckedChange={(v) => update(row.key, v)}
              aria-label={row.label}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
