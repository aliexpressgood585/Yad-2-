import { ApiError, enforceRateLimit, handleError, ok, requireSession } from "@/lib/api";
import { MAX_IMAGES } from "@/lib/site";
import { processImage } from "@/lib/upload";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * העלאת תמונות למודעה. מחזיר URL, blurhash ו-phash לכל קובץ.
 * המטא-דאטה (כולל מיקום GPS) מוסרת בשרת ולא רק בצד הלקוח.
 */
export async function POST(req: Request) {
  try {
    const session = await requireSession();
    await enforceRateLimit("upload", session.user.id);

    const form = await req.formData();
    const files = form.getAll("files").filter((f): f is File => f instanceof File);

    if (!files.length) throw new ApiError(400, "לא נבחרו קבצים");
    if (files.length > MAX_IMAGES) {
      throw new ApiError(400, `ניתן להעלות עד ${MAX_IMAGES} תמונות בבת אחת`);
    }

    const results = await Promise.allSettled(files.map((f) => processImage(f)));

    const images = results
      .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof processImage>>> =>
        r.status === "fulfilled",
      )
      .map((r) => r.value);

    const errors = results
      .filter((r): r is PromiseRejectedResult => r.status === "rejected")
      .map((r) => (r.reason as Error).message);

    if (!images.length) {
      throw new ApiError(422, errors[0] ?? "עיבוד התמונות נכשל");
    }

    return ok({ images, errors });
  } catch (err) {
    return handleError(err);
  }
}
