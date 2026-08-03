import Link from "next/link";
import { ChevronLeft } from "lucide-react";

/**
 * פירורי לחם לדפי המחירון.
 *
 * מקביל ל-`Breadcrumbs` של הקטגוריות, אך על נתיבים חופשיים ולא על עץ
 * הקטגוריות. ב-RTL החץ המפריד מצביע שמאלה.
 */
export function PriceGuideBreadcrumbs({
  items,
}: {
  items: { name: string; href?: string }[];
}) {
  return (
    <nav aria-label="מסלול ניווט">
      <ol className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
        <li>
          <Link href="/" className="hover:text-foreground hover:underline">
            דף הבית
          </Link>
        </li>
        {items.map((item, i) => (
          <li key={`${item.name}-${i}`} className="flex items-center gap-1">
            <ChevronLeft className="size-3" aria-hidden />
            {item.href ? (
              <Link href={item.href} className="hover:text-foreground hover:underline">
                {item.name}
              </Link>
            ) : (
              <span aria-current="page" className="font-medium text-foreground">
                {item.name}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
