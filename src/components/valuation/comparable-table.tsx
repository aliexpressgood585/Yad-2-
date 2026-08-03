import Link from "next/link";

import { BidiText } from "@/components/bidi-text";
import { formatPrice } from "@/lib/format";

export type ComparableRow = {
  slug: string;
  title: string;
  price: number;
  city: string;
  /** ערכים נוספים, בסדר של `headers` */
  columns: string[];
};

/**
 * המודעות שמהן חושב המספר.
 *
 * הטבלה אינה תוספת נחמדה: מדד שאי אפשר לפתוח ולראות ממה הוא מורכב
 * מבקש אמון עיוור. כל שורה מקושרת למודעה עצמה.
 */
export function ComparableTable({
  rows,
  headers,
}: {
  rows: ComparableRow[];
  headers: string[];
}) {
  if (!rows.length) return null;

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full min-w-[32rem] text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            <th scope="col" className="p-3 text-start font-medium">מודעה</th>
            {headers.map((h) => (
              <th key={h} scope="col" className="p-3 text-start font-medium">
                {h}
              </th>
            ))}
            <th scope="col" className="p-3 text-start font-medium">מחיר</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.slug} className="border-b border-border/60 last:border-b-0">
              <th scope="row" className="max-w-[18rem] p-3 text-start font-normal">
                <Link href={`/item/${row.slug}`} className="font-medium hover:underline">
                  <BidiText>{row.title}</BidiText>
                </Link>
                <span className="block text-xs text-muted-foreground">{row.city}</span>
              </th>
              {/* .num יושב על span ולא על התא עצמו: על תא טבלה הוא מבודד
                  את הקופסה ושובר את חישוב רוחב העמודות מול השורה הראשונה */}
              {row.columns.map((c, i) => (
                <td key={i} className="whitespace-nowrap p-3 text-muted-foreground">
                  <span className="num">{c}</span>
                </td>
              ))}
              <td className="whitespace-nowrap p-3 font-semibold">
                <span className="num">{formatPrice(row.price)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
