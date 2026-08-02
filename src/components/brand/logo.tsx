import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * לוגו טקסטואלי עצמאי — ריבוע עם האות "ל" לצד שם המותג.
 */
export function Logo({
  className,
  showWordmark = true,
  href = "/",
}: {
  className?: string;
  showWordmark?: boolean;
  href?: string | null;
}) {
  const content = (
    <span className={cn("group inline-flex items-center gap-2", className)}>
      <span
        aria-hidden
        className={cn(
          "grid size-9 place-items-center rounded-[10px] bg-primary text-primary-foreground",
          "font-heading text-xl font-extrabold leading-none shadow-soft",
          "transition-transform duration-150 group-hover:-rotate-3",
        )}
      >
        ל
      </span>
      {showWordmark ? (
        <span className="font-heading text-xl font-extrabold tracking-tight">
          לוח
        </span>
      ) : null}
      <span className="sr-only">לוח — דף הבית</span>
    </span>
  );

  if (!href) return content;
  return (
    <Link href={href} className="rounded-md focus-visible:ring-2 focus-visible:ring-ring">
      {content}
    </Link>
  );
}
