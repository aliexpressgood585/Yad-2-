import { z } from "zod";

import { normalizePhone } from "@/lib/utils";

/** טלפון ישראלי נייד או קווי. */
export const phoneSchema = z
  .string()
  .trim()
  .transform(normalizePhone)
  .refine((p) => /^0(5\d|[2-4,8-9])\d{7,8}$/.test(p), {
    message: "מספר הטלפון אינו תקין",
  });

export const passwordSchema = z
  .string()
  .min(8, "הסיסמה חייבת להכיל לפחות 8 תווים")
  .max(72, "הסיסמה ארוכה מדי")
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), {
    message: "הסיסמה חייבת לכלול אותיות וגם ספרות",
  });

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("כתובת האימייל אינה תקינה");

export const registerSchema = z.object({
  name: z.string().trim().min(2, "יש להזין שם מלא").max(60),
  email: emailSchema,
  password: passwordSchema,
  phone: phoneSchema.optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "יש להזין סיסמה"),
});

export const otpSendSchema = z.object({
  phone: phoneSchema,
  purpose: z.enum(["login", "verify"]).default("login"),
});

export const otpVerifySchema = z.object({
  phone: phoneSchema,
  code: z.string().regex(/^\d{6}$/, "הקוד חייב להיות בן 6 ספרות"),
});

export const profileSchema = z.object({
  name: z.string().trim().min(2).max(60),
  bio: z.string().trim().max(500).optional().or(z.literal("")),
  avatar: z.string().url().optional().or(z.literal("")),
  businessName: z.string().trim().max(80).optional().or(z.literal("")),
  businessAbout: z.string().trim().max(1000).optional().or(z.literal("")),
  businessCity: z.string().trim().max(60).optional().or(z.literal("")),
});

/* --- מודעות ---------------------------------------------------------------- */

export const listingImageSchema = z.object({
  url: z.string().min(1),
  thumbUrl: z.string().optional(),
  blurhash: z.string().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  phash: z.string().optional(),
});

/** ערך של שדה דינמי — טקסט, מספר, בוליאני או רשימה. */
export const attributeValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.string()),
]);

export const listingInputSchema = z.object({
  categoryId: z.string().min(1, "יש לבחור קטגוריה"),
  title: z
    .string()
    .trim()
    .min(6, "הכותרת קצרה מדי — לפחות 6 תווים")
    .max(80, "הכותרת ארוכה מדי"),
  description: z
    .string()
    .trim()
    .min(20, "התיאור קצר מדי — לפחות 20 תווים")
    .max(5000, "התיאור ארוך מדי"),
  price: z.number().int().min(0).max(100_000_000).nullable(),
  isNegotiable: z.boolean().default(false),
  city: z.string().trim().min(1, "יש לבחור עיר"),
  neighborhood: z.string().trim().max(60).optional().or(z.literal("")),
  address: z.string().trim().max(120).optional().or(z.literal("")),
  lat: z.number().min(29).max(34).nullable().optional(),
  lng: z.number().min(33).max(36).nullable().optional(),
  contactPhone: phoneSchema.optional(),
  contactName: z.string().trim().max(40).optional().or(z.literal("")),
  allowChat: z.boolean().default(true),
  images: z.array(listingImageSchema).max(12, "ניתן להעלות עד 12 תמונות"),
  attributes: z.record(attributeValueSchema).default({}),
});

export const publishSchema = listingInputSchema.extend({
  images: z
    .array(listingImageSchema)
    .min(1, "יש להוסיף לפחות תמונה אחת")
    .max(12, "ניתן להעלות עד 12 תמונות"),
});

/* --- אינטראקציות ------------------------------------------------------------ */

export const messageSchema = z.object({
  listingId: z.string().min(1),
  body: z.string().trim().min(1, "לא ניתן לשלוח הודעה ריקה").max(2000),
});

export const replySchema = z.object({
  conversationId: z.string().min(1),
  body: z.string().trim().min(1).max(2000),
});

export const reportSchema = z.object({
  listingId: z.string().min(1),
  reason: z.enum([
    "SPAM",
    "FRAUD",
    "OFFENSIVE",
    "DUPLICATE",
    "WRONG_CATEGORY",
    "SOLD_ALREADY",
    "OTHER",
  ]),
  details: z.string().trim().max(1000).optional().or(z.literal("")),
});

export const reviewSchema = z.object({
  targetId: z.string().min(1),
  listingId: z.string().min(1).optional(),
  rating: z.number().int().min(1).max(5),
  body: z.string().trim().max(1000).optional().or(z.literal("")),
});

export const savedSearchSchema = z.object({
  name: z.string().trim().min(2).max(60),
  filters: z.record(z.unknown()),
  frequency: z.enum(["OFF", "INSTANT", "DAILY", "WEEKLY"]).default("INSTANT"),
});

/* --- חיפוש ------------------------------------------------------------------ */

const csv = (v: unknown) =>
  typeof v === "string" ? v.split(",").filter(Boolean) : Array.isArray(v) ? v : undefined;

export const searchParamsSchema = z.object({
  q: z.string().trim().max(120).optional(),
  category: z.string().optional(),
  cities: z.preprocess(csv, z.array(z.string()).max(20).optional()),
  regions: z.preprocess(csv, z.array(z.string()).max(10).optional()),
  priceMin: z.coerce.number().int().min(0).optional(),
  priceMax: z.coerce.number().int().min(0).optional(),
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
  radius: z.coerce.number().min(1).max(300).optional(),
  sort: z
    .enum(["relevance", "date", "price_asc", "price_desc", "distance", "views"])
    .default("date"),
  page: z.coerce.number().int().min(1).max(200).default(1),
  perPage: z.coerce.number().int().min(1).max(48).default(24),
  withImages: z.coerce.boolean().optional(),
  promotedOnly: z.coerce.boolean().optional(),
  sellerId: z.string().optional(),
});

export type SearchParamsInput = z.infer<typeof searchParamsSchema>;
export type ListingInput = z.infer<typeof listingInputSchema>;
