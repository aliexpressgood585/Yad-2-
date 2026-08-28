"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  CheckCircle2,
  Eye,
  Heart,
  MessageCircle,
  MoreVertical,
  Pencil,
  Phone,
  RefreshCw,
  Rocket,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { BoostDialog } from "@/components/my/boost-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { timeAgo } from "@/lib/utils";
import { formatPrice, formatCount } from "@/lib/format";

export type MyListing = {
  id: string;
  slug: string;
  title: string;
  price: number | null;
  status: string;
  city: string;
  categoryName: string;
  imageUrl: string | null;
  viewCount: number;
  revealCount: number;
  favoriteCount: number;
  messageCount: number;
  isPromoted: boolean;
  expiresAt: string | null;
  createdAt: string;
};

const STATUS_BADGE: Record<string, { label: string; variant: "success" | "muted" | "warning" | "destructive" }> = {
  ACTIVE: { label: "פעילה", variant: "success" },
  DRAFT: { label: "טיוטה", variant: "muted" },
  PENDING: { label: "בבדיקה", variant: "warning" },
  SOLD: { label: "נמכרה", variant: "muted" },
  EXPIRED: { label: "פג תוקף", variant: "warning" },
  BANNED: { label: "הוסרה", variant: "destructive" },
};

export function MyListingRow({
  listing,
  paymentsEnabled = false,
}: {
  listing: MyListing;
  /** האם יש ספק סליקה מוגדר. בלעדיו לא מוצע קידום. */
  paymentsEnabled?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [boostOpen, setBoostOpen] = React.useState(false);

  const badge = STATUS_BADGE[listing.status] ?? STATUS_BADGE.DRAFT!;

  const daysLeft = listing.expiresAt
    ? Math.ceil((new Date(listing.expiresAt).getTime() - Date.now()) / 86_400_000)
    : null;

  async function act(action: string, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setPending(true);
    try {
      const res = await fetch(`/api/listings/${listing.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "הפעולה נכשלה");
        return;
      }
      const messages: Record<string, string> = {
        sold: "המודעה סומנה כנמכרה",
        renew: "המודעה חודשה ל-45 יום נוספים",
        activate: "המודעה פורסמה מחדש",
        pause: "המודעה הועברה לטיוטות",
        delete: "המודעה הוסרה",
      };
      toast.success(messages[action] ?? "בוצע");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  const stats = [
    { icon: Eye, value: listing.viewCount, label: "צפיות" },
    { icon: Phone, value: listing.revealCount, label: "חשיפות טלפון" },
    { icon: Heart, value: listing.favoriteCount, label: "שמירות" },
    { icon: MessageCircle, value: listing.messageCount, label: "שיחות" },
  ];

  return (
    <>
      <article className="flex gap-3 rounded-lg border border-border bg-card p-3">
        <Link
          href={`/item/${listing.slug}`}
          className="relative aspect-[4/3] w-24 shrink-0 overflow-hidden rounded-md bg-muted sm:w-32"
        >
          {listing.imageUrl ? (
            <Image
              src={listing.imageUrl}
              alt=""
              fill
              sizes="128px"
              className="object-cover"
              unoptimized={listing.imageUrl.startsWith("/uploads")}
            />
          ) : null}
        </Link>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="truncate font-medium">
                <Link href={`/item/${listing.slug}`} className="hover:underline">
                  {listing.title}
                </Link>
              </h3>
              <p className="num font-heading font-bold text-primary">
                {formatPrice(listing.price)}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <Badge variant={badge.variant}>{badge.label}</Badge>
              {listing.isPromoted ? <Badge variant="accent">מקודמת</Badge> : null}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            {listing.categoryName} · {listing.city} · פורסמה {timeAgo(listing.createdAt)}
            {daysLeft !== null && listing.status === "ACTIVE" ? (
              <span className={daysLeft <= 7 ? " font-medium text-warning" : ""}>
                {" "}· נותרו <span className="num">{Math.max(0, daysLeft)}</span> ימים
              </span>
            ) : null}
          </p>

          <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {stats.map((s) => (
              <li key={s.label} className="flex items-center gap-1">
                <s.icon className="size-3.5" aria-hidden />
                <span className="num">{formatCount(s.value)}</span>
                <span className="sr-only">{s.label}</span>
              </li>
            ))}
          </ul>

          <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
            <Button asChild variant="outline" size="sm">
              <Link href={`/publish/${listing.id}/edit`}>
                <Pencil aria-hidden />
                עריכה
              </Link>
            </Button>

            {listing.status === "ACTIVE" ? (
              <>
                <Button
                  variant="soft"
                  size="sm"
                  onClick={() => setBoostOpen(true)}
                  disabled={pending}
                >
                  <Rocket aria-hidden />
                  קידום
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void act("renew")}
                  disabled={pending}
                >
                  <RefreshCw aria-hidden />
                  חידוש
                </Button>
              </>
            ) : null}

            {(listing.status === "DRAFT" || listing.status === "EXPIRED") ? (
              <Button
                variant="default"
                size="sm"
                onClick={() => void act("activate")}
                disabled={pending}
              >
                פרסום
              </Button>
            ) : null}

            <Button asChild variant="ghost" size="sm">
              <Link href={`/my/listings/${listing.id}`}>
                <BarChart3 aria-hidden />
                סטטיסטיקות
              </Link>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="פעולות נוספות">
                  <MoreVertical aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {listing.status === "ACTIVE" ? (
                  <>
                    <DropdownMenuItem onClick={() => void act("sold")}>
                      <CheckCircle2 aria-hidden />
                      סימון כנמכרה
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => void act("pause")}>
                      השהיה (העברה לטיוטות)
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                ) : null}
                <DropdownMenuItem
                  destructive
                  onClick={() =>
                    void act("delete", "למחוק את המודעה? הפעולה אינה הפיכה.")
                  }
                >
                  <Trash2 aria-hidden />
                  מחיקה
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </article>

      <BoostDialog
        listingId={listing.id}
        listingTitle={listing.title}
        open={boostOpen}
        onOpenChange={setBoostOpen}
        paymentsEnabled={paymentsEnabled}
      />
    </>
  );
}
