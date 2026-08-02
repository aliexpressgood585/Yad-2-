import Link from "next/link";
import { Home, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getRootCategories } from "@/lib/categories";

export default async function NotFound() {
  const categories = await getRootCategories();

  return (
    <div className="container flex min-h-[60vh] flex-col items-center justify-center gap-5 py-12 text-center">
      <p className="font-heading text-6xl font-extrabold text-primary num">404</p>

      <div>
        <h1 className="font-heading text-2xl font-extrabold">הדף לא נמצא</h1>
        <p className="mt-1 max-w-md text-pretty text-muted-foreground">
          ייתכן שהמודעה הוסרה, נמכרה או שפג תוקפה. אפשר לחפש משהו אחר או לעיין בקטגוריות.
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        <Button asChild>
          <Link href="/">
            <Home aria-hidden />
            לדף הבית
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/search">
            <Search aria-hidden />
            לחיפוש
          </Link>
        </Button>
      </div>

      <nav aria-label="קטגוריות" className="mt-2">
        <ul className="flex flex-wrap justify-center gap-1.5">
          {categories.map((c) => (
            <li key={c.id}>
              <Link
                href={`/${c.slug}`}
                className="rounded-full border border-border px-3 py-1.5 text-sm transition-colors hover:border-primary hover:text-primary"
              >
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
