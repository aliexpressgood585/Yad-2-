import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { authConfig } from "@/lib/auth.config";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { consumeOtp } from "@/lib/otp";
import { normalizePhone } from "@/lib/utils";

const passwordSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const otpSchema = z.object({
  phone: z.string().min(9),
  code: z.string().length(6),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [
    ...authConfig.providers,

    /** התחברות באימייל וסיסמה. */
    Credentials({
      id: "password",
      name: "אימייל וסיסמה",
      credentials: {
        email: { label: "אימייל", type: "email" },
        password: { label: "סיסמה", type: "password" },
      },
      async authorize(raw) {
        const parsed = passwordSchema.safeParse(raw);
        if (!parsed.success) return null;

        /*
         * הגבלת קצב על ניחוש סיסמאות, לפי כתובת המייל.
         * המגבלה הוגדרה מזמן אבל מעולם לא נאכפה כאן — כלומר דף
         * ההתחברות היה פתוח לניסיונות בלתי מוגבלים. המפתח הוא המייל
         * ולא ה-IP, כי תוקף מחליף IP בקלות ולא את היעד.
         */
        const email = parsed.data.email.toLowerCase();
        const gate = await rateLimit("login", `pw:${email}`);
        if (!gate.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email.toLowerCase() },
        });
        if (!user?.passwordHash || user.isBlocked || user.deletedAt) return null;

        const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.avatar,
          role: user.role,
          phone: user.phone,
          verifiedAt: user.verifiedAt,
        };
      },
    }),

    /** התחברות בקוד חד-פעמי שנשלח ב-SMS. */
    Credentials({
      id: "otp",
      name: "קוד ב-SMS",
      credentials: {
        phone: { label: "טלפון", type: "tel" },
        code: { label: "קוד", type: "text" },
      },
      async authorize(raw) {
        const parsed = otpSchema.safeParse(raw);
        if (!parsed.success) return null;

        const phone = normalizePhone(parsed.data.phone);

        // אותו שיקול, על ניחוש קוד בן שש ספרות
        const gate = await rateLimit("login", `otp:${phone}`);
        if (!gate.success) return null;

        const ok = await consumeOtp(phone, parsed.data.code, "login");
        if (!ok) return null;

        const user = await prisma.user.upsert({
          where: { phone },
          update: { verifiedAt: new Date(), lastSeenAt: new Date() },
          create: {
            phone,
            name: `משתמש ${phone.slice(-4)}`,
            verifiedAt: new Date(),
          },
        });
        if (user.isBlocked || user.deletedAt) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.avatar,
          role: user.role,
          phone: user.phone,
          verifiedAt: user.verifiedAt,
        };
      },
    }),
  ],
  events: {
    /** משתמש שנוצר דרך OAuth מקבל שם ברירת מחדל אם ספק הזהות לא סיפק אחד. */
    async createUser({ user }) {
      if (!user.name && user.id) {
        await prisma.user.update({
          where: { id: user.id },
          data: { name: user.email?.split("@")[0] ?? "משתמש חדש" },
        });
      }
    },
  },
});
