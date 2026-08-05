import { History, TrendingDown } from "lucide-react";

import {
  priceInsight,
  priceInsightLabel,
  repostLabel,
  type PricePoint,
  type RepostInfo,
} from "@/lib/seller-history";
import { cn } from "@/lib/utils";

/**
 * שקיפות על התנהגות המודעה לאורך זמן.
 *
 * שני נתונים שהלוח כבר שומר ולא הראה: כמה פעמים אותו תוכן פורסם מחדש,
 * ומה באמת קרה למחיר מנקודת הפתיחה.
 *
 * **עובדה, לא האשמה.** יש סיבות לגיטימיות לפרסם מודעה מחדש ולהעלות
 * מחיר. הניסוח מוסר את הנתון והקונה מסיק בעצמו — וזה גם מה שהופך
 * אותו לאמין, ומה שמונע מהלוח להיות עוין כלפי רוב המוכרים הישרים.
 *
 * לא מוצג דבר כשאין ממצא. שורה שכתוב בה "פורסם פעם אחת" היא רעש.
 */
export function SellerHistoryNote({
  repost,
  priceHistory,
  className,
}: {
  repost: RepostInfo | null;
  priceHistory: PricePoint[];
  className?: string;
}) {
  const reposts = repostLabel(repost);
  const insight = priceInsight(priceHistory);
  const price = priceInsightLabel(insight);

  if (!reposts && !price) return null;

  return (
    <ul className={cn("flex flex-col gap-1.5", className)}>
      {reposts ? (
        <li className="flex items-start gap-2 text-sm text-muted-foreground">
          <History className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span className="num">{reposts}</span>
        </li>
      ) : null}

      {price ? (
        <li
          className={cn(
            "flex items-start gap-2 text-sm",
            /*
             * ירידה אמיתית היא בשורה טובה לקונה ומקבלת את צבע הקריאה.
             * "הועלה ואז הורד" הוא סייג ולא בשורה, ולכן הוא נשאר בצבע
             * הטקסט המשני — הוא לא אזהרה על הונאה.
             */
            insight?.kind === "net-drop" ? "text-info" : "text-muted-foreground",
          )}
        >
          <TrendingDown className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{price}</span>
        </li>
      ) : null}
    </ul>
  );
}
