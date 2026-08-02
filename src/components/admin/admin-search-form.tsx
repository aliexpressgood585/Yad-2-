"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** שורת חיפוש וסינון משותפת למסכי הניהול. */
export function AdminSearchForm({
  placeholder,
  statuses,
}: {
  placeholder: string;
  statuses?: { value: string; label: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = React.useState(params.get("q") ?? "");

  function apply(next: Record<string, string | null>) {
    const sp = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value === null || value === "") sp.delete(key);
      else sp.set(key, value);
    }
    sp.delete("page");
    const qs = sp.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        apply({ q: q.trim() || null });
      }}
      className="flex flex-wrap items-center gap-2"
    >
      <div className="relative min-w-64 flex-1">
        <Search
          className="pointer-events-none absolute start-3 top-3 size-4 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          className="ps-9"
          aria-label={placeholder}
        />
      </div>

      {statuses ? (
        <Select
          value={params.get("status") ?? "all"}
          onValueChange={(v) => apply({ status: v === "all" ? null : v })}
        >
          <SelectTrigger className="w-44" aria-label="סינון לפי סטטוס">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statuses.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}

      <Button type="submit">חיפוש</Button>
    </form>
  );
}
