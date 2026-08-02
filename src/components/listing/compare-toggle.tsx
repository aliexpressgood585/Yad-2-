"use client";

import * as React from "react";
import { Scale } from "lucide-react";
import { toast } from "sonner";

import { useCompare, type CompareItem } from "@/stores/compare";
import { MAX_COMPARE } from "@/lib/site";
import { cn } from "@/lib/utils";

export function CompareToggle({
  listing,
  className,
}: {
  listing: CompareItem;
  className?: string;
}) {
  const toggle = useCompare((s) => s.toggle);
  const selected = useCompare((s) => s.items.some((i) => i.id === listing.id));
  const [mounted, setMounted] = React.useState(false);

  // המצב נשמר ב-localStorage; מרנדרים אותו רק אחרי העלייה בצד הלקוח
  React.useEffect(() => setMounted(true), []);

  function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const result = toggle(listing);
    if (result === "full") {
      toast.error(`אפשר להשוות עד ${MAX_COMPARE} מודעות בו-זמנית`);
    } else if (result === "category-mismatch") {
      toast.error("ניתן להשוות רק מודעות מאותה קטגוריה");
    } else if (result === "added") {
      toast.success("נוסף להשוואה", {
        action: { label: "להשוואה", onClick: () => (window.location.href = "/compare") },
      });
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={mounted ? selected : false}
      aria-label={selected ? "הסרה מההשוואה" : "הוספה להשוואה"}
      className={cn(
        "relative z-10 grid size-8 place-items-center rounded-full bg-background/85 shadow-soft backdrop-blur transition-colors",
        "hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        mounted && selected && "bg-primary text-primary-foreground hover:bg-primary",
        className,
      )}
    >
      <Scale className="size-4" aria-hidden />
    </button>
  );
}
