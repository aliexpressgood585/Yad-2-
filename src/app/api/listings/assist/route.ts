import { z } from "zod";

import { handleError, ok, parseBody, requireSession } from "@/lib/api";
import { findPossibleDuplicates, suggestPrice } from "@/lib/listing-write";

const schema = z.object({
  categoryId: z.string().min(1),
  title: z.string().trim().default(""),
  description: z.string().trim().default(""),
  price: z.number().int().nullable().default(null),
  excludeId: z.string().optional(),
});

/**
 * עוזר הפרסום: מחזיר הצעת טווח מחירים לפי הקטגוריה
 * ורשימת מודעות שעשויות להיות כפילות של מה שנכתב.
 */
export async function POST(req: Request) {
  try {
    const session = await requireSession();
    const input = await parseBody(req, schema);

    const [price, duplicates] = await Promise.all([
      suggestPrice(input.categoryId),
      input.title.length >= 6
        ? findPossibleDuplicates({
            userId: session.user.id,
            categoryId: input.categoryId,
            title: input.title,
            description: input.description,
            price: input.price,
            excludeId: input.excludeId,
          })
        : Promise.resolve([]),
    ]);

    return ok({
      priceSuggestion: price,
      duplicates: duplicates.map((d) => ({
        id: d.id,
        slug: d.slug,
        title: d.title,
        status: d.status,
      })),
    });
  } catch (err) {
    return handleError(err);
  }
}
