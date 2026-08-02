"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { BadgeCheck, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { OtpFields } from "@/components/auth/otp-fields";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CITY_NAMES } from "@/lib/cities";
import { formatPhone } from "@/lib/utils";

type ProfileUser = {
  name: string;
  email: string | null;
  phone: string | null;
  phoneVerified: boolean;
  bio: string;
  avatar: string;
  role: string;
  businessName: string;
  businessAbout: string;
  businessCity: string;
};

export function ProfileForm({ user }: { user: ProfileUser }) {
  const router = useRouter();
  const { update } = useSession();

  const [form, setForm] = React.useState(user);
  const [saving, setSaving] = React.useState(false);
  const [verifyOpen, setVerifyOpen] = React.useState(false);
  const [verified, setVerified] = React.useState(user.phoneVerified);
  const [phone, setPhone] = React.useState(user.phone);

  const isBusiness = form.role === "BUSINESS";

  function set<K extends keyof ProfileUser>(key: K, value: ProfileUser[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          bio: form.bio,
          avatar: form.avatar,
          businessName: form.businessName,
          businessAbout: form.businessAbout,
          businessCity: form.businessCity,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "השמירה נכשלה");
        return;
      }
      await update({ name: form.name, picture: form.avatar || undefined });
      toast.success("הפרופיל עודכן");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function verifyPhone(newPhone: string, code: string) {
    const res = await fetch("/api/auth/otp", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone: newPhone, code }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? "האימות נכשל");
      return false;
    }
    await update({ phone: data.phone, phoneVerified: true });
    setPhone(data.phone);
    setVerified(true);
    setVerifyOpen(false);
    toast.success("הטלפון אומת");
    router.refresh();
    return true;
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>פרטים אישיים</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="p-name" required>
              שם מלא
            </Label>
            <Input
              id="p-name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              maxLength={60}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="p-email">אימייל</Label>
            <Input id="p-email" value={form.email ?? ""} dir="ltr" disabled />
            <p className="text-xs text-muted-foreground">
              לשינוי כתובת האימייל יש לפנות לתמיכה.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>טלפון</Label>
            <div className="flex items-center gap-2">
              <Input value={phone ? formatPhone(phone) : "לא הוגדר"} dir="ltr" disabled />
              {verified ? (
                <span className="flex shrink-0 items-center gap-1 text-sm text-success">
                  <BadgeCheck className="size-4" aria-hidden />
                  מאומת
                </span>
              ) : (
                <Button type="button" variant="outline" size="sm" onClick={() => setVerifyOpen(true)}>
                  אימות
                </Button>
              )}
            </div>
            {!verified ? (
              <p className="flex items-center gap-1.5 text-xs text-warning">
                <ShieldAlert className="size-3.5" aria-hidden />
                נדרש אימות טלפון כדי לפרסם מודעות.
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="p-bio">קצת עליי</Label>
            <Textarea
              id="p-bio"
              value={form.bio}
              onChange={(e) => set("bio", e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="מוכר פריטים במצב מצוין, זמין בוואטסאפ…"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="p-avatar">קישור לתמונת פרופיל</Label>
            <Input
              id="p-avatar"
              type="url"
              dir="ltr"
              value={form.avatar}
              onChange={(e) => set("avatar", e.target.value)}
              placeholder="https://…"
            />
          </div>
        </CardContent>
      </Card>

      {isBusiness ? (
        <Card>
          <CardHeader>
            <CardTitle>פרטי העסק</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="p-bname">שם העסק</Label>
              <Input
                id="p-bname"
                value={form.businessName}
                onChange={(e) => set("businessName", e.target.value)}
                maxLength={80}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-bcity">עיר הפעילות</Label>
              <Select value={form.businessCity} onValueChange={(v) => set("businessCity", v)}>
                <SelectTrigger id="p-bcity">
                  <SelectValue placeholder="בחירת יישוב" />
                </SelectTrigger>
                <SelectContent>
                  {CITY_NAMES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-babout">על העסק</Label>
              <Textarea
                id="p-babout"
                value={form.businessAbout}
                onChange={(e) => set("businessAbout", e.target.value)}
                rows={4}
                maxLength={1000}
              />
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Button type="submit" loading={saving} size="lg">
        שמירת השינויים
      </Button>

      <Dialog open={verifyOpen} onOpenChange={setVerifyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>אימות מספר טלפון</DialogTitle>
            <DialogDescription>
              המספר לא יוצג בפומבי — הוא נחשף רק כשמתעניין לוחץ על &quot;הצגת מספר&quot;.
            </DialogDescription>
          </DialogHeader>
          <div className="pt-2">
            <OtpFields purpose="verify" initialPhone={phone ?? ""} onVerify={verifyPhone} />
          </div>
        </DialogContent>
      </Dialog>
    </form>
  );
}
