"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/business-roles";

export type TeamRow = {
  userId: string;
  name: string;
  email: string | null;
  role: "MANAGER" | "AGENT";
  listings: number;
};

/**
 * ניהול הצוות.
 *
 * הבעלים אינו מופיע ברשימה כי הוא אינו חבר צוות אלא העסק עצמו — וזה
 * מה שמונע את המצב שבו מישהו מסיר את הבעלים מהעסק שלו.
 */
export function TeamManager({
  owner,
  members,
}: {
  owner: { name: string; email: string | null; listings: number };
  members: TeamRow[];
}) {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<"MANAGER" | "AGENT">("AGENT");
  const [busy, setBusy] = React.useState<string | null>(null);

  async function send(method: string, body: unknown, key: string) {
    setBusy(key);
    try {
      const res = await fetch("/api/business/team", {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "הפעולה נכשלה");
      router.refresh();
      return data;
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      <section className="border border-border bg-card p-4">
        <h2 className="font-heading text-base">הצוות</h2>

        <ul className="mt-3 divide-y divide-border">
          <li className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">{owner.name}</p>
              <p className="text-xs text-muted-foreground" dir="ltr">
                {owner.email ?? "—"}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              <span className="num">{owner.listings}</span> מודעות
            </p>
            <span className="border border-primary px-2 py-0.5 text-xs text-primary">
              {ROLE_LABELS.OWNER}
            </span>
          </li>

          {members.map((member) => (
            <li
              key={member.userId}
              className="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">{member.name}</p>
                <p className="text-xs text-muted-foreground" dir="ltr">
                  {member.email ?? "—"}
                </p>
              </div>

              <p className="text-xs text-muted-foreground">
                <span className="num">{member.listings}</span> מודעות
              </p>

              <div className="flex items-center gap-2">
                <select
                  value={member.role}
                  aria-label={`תפקיד של ${member.name}`}
                  disabled={busy === member.userId}
                  onChange={(e) =>
                    void send(
                      "PATCH",
                      { userId: member.userId, role: e.target.value },
                      member.userId,
                    ).then(() => toast.success("התפקיד עודכן"))
                  }
                  className="h-9 border border-input bg-background px-2 text-sm"
                >
                  <option value="MANAGER">{ROLE_LABELS.MANAGER}</option>
                  <option value="AGENT">{ROLE_LABELS.AGENT}</option>
                </select>

                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy === member.userId}
                  onClick={() =>
                    void send("DELETE", { userId: member.userId }, member.userId)
                      .then(() => toast.success("החבר הוסר מהצוות. המודעות שפרסם נשארו בעסק."))
                      .catch((err) => toast.error(err.message))
                  }
                >
                  הסרה
                </Button>
              </div>
            </li>
          ))}
        </ul>

        {members.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            אין עדיין חברי צוות. מודעות שתפרסמו נשארות שלכם.
          </p>
        ) : null}
      </section>

      <section className="border border-border bg-card p-4">
        <h2 className="font-heading text-base">צירוף עובד</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          העובד צריך חשבון בלוח. שלחו לו קישור הרשמה, ואז צרפו אותו בכתובת
          הדוא&quot;ל שאיתה נרשם.
        </p>

        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="min-w-56 flex-1">
            <Label htmlFor="team-email">כתובת דוא&quot;ל</Label>
            <Input
              id="team-email"
              type="email"
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="team-role">תפקיד</Label>
            <select
              id="team-role"
              value={role}
              onChange={(e) => setRole(e.target.value as "MANAGER" | "AGENT")}
              className="mt-1 block h-10 border border-input bg-background px-3 text-sm"
            >
              <option value="AGENT">{ROLE_LABELS.AGENT}</option>
              <option value="MANAGER">{ROLE_LABELS.MANAGER}</option>
            </select>
          </div>

          <Button
            loading={busy === "add"}
            disabled={!email}
            onClick={() =>
              void send("POST", { email, role }, "add")
                .then(() => {
                  toast.success("העובד צורף לצוות");
                  setEmail("");
                })
                .catch((err) => toast.error(err.message))
            }
          >
            צירוף
          </Button>
        </div>

        <dl className="mt-4 space-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
          {(["MANAGER", "AGENT"] as const).map((r) => (
            <div key={r} className="flex gap-2">
              <dt className="font-medium text-foreground">{ROLE_LABELS[r]}</dt>
              <dd>{ROLE_DESCRIPTIONS[r]}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
