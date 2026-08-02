import { cn } from "@/lib/utils";

/** שלד טעינה עם אפקט הבהוב עדין. */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md bg-muted",
        "after:absolute after:inset-0 after:-translate-x-full after:animate-shimmer",
        "after:bg-gradient-to-l after:from-transparent after:via-background/60 after:to-transparent",
        className,
      )}
      aria-hidden
      {...props}
    />
  );
}

export { Skeleton };
