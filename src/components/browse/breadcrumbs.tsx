import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import type { CategoryNode } from "@/lib/categories";

/**
 * פירורי לחם. ב-RTL החץ המפריד מצביע שמאלה.
 * הנתיב מורכב מ-/<root>/<child>, ולכן בונים אותו מצטבר.
 */
export function Breadcrumbs({ path }: { path: Pick<CategoryNode, "id" | "slug" | "name">[] }) {
  return (
    <nav aria-label="מסלול ניווט">
      <ol className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
        <li>
          <Link href="/" className="hover:text-foreground hover:underline">
            דף הבית
          </Link>
        </li>
        {path.map((node, i) => {
          const href =
            i === 0 ? `/${node.slug}` : `/${path[0]!.slug}/${node.slug}`;
          const isLast = i === path.length - 1;
          return (
            <li key={node.id} className="flex items-center gap-1">
              <ChevronLeft className="size-3" aria-hidden />
              {isLast ? (
                <span aria-current="page" className="font-medium text-foreground">
                  {node.name}
                </span>
              ) : (
                <Link href={href} className="hover:text-foreground hover:underline">
                  {node.name}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
