"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Heart } from "lucide-react";
import { toast } from "sonner";

import { useFavorites } from "@/stores/favorites";
import { cn } from "@/lib/utils";

type Props = {
  listingId: string;
  className?: string;
  variant?: "overlay" | "inline";
};

export function FavoriteButton({ listingId, className, variant = "overlay" }: Props) {
  const router = useRouter();
  const { status } = useSession();
  const load = useFavorites((s) => s.load);
  const toggle = useFavorites((s) => s.toggle);
  const isFavorite = useFavorites((s) => s.ids.has(listingId));
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    if (status === "authenticated") void load();
  }, [status, load]);

  async function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (status !== "authenticated") {
      toast.error("יש להתחבר כדי לשמור מודעות במועדפים", {
        action: { label: "התחברות", onClick: () => router.push("/auth/login") },
      });
      return;
    }

    setPending(true);
    const result = await toggle(listingId);
    setPending(false);

    if (result === "added") toast.success("נשמר במועדפים");
    else if (result === "removed") toast("הוסר מהמועדפים");
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-pressed={isFavorite}
      aria-label={isFavorite ? "הסרה מהמועדפים" : "שמירה במועדפים"}
      className={cn(
        "relative z-10 grid place-items-center rounded-full transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        variant === "overlay"
          ? "size-8 bg-background/85 shadow-lifted backdrop-blur hover:bg-background"
          : "size-10 border border-border hover:bg-muted",
        className,
      )}
    >
      <Heart
        className={cn(
          "size-4 transition-all duration-150",
          variant === "inline" && "size-5",
          isFavorite ? "scale-110 fill-destructive text-destructive" : "text-foreground",
        )}
        aria-hidden
      />
    </button>
  );
}
