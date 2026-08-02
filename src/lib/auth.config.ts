import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

/**
 * תצורה בטוחה ל-Edge (ללא Prisma / bcrypt) — משמשת ב-middleware.
 * ספק ה-Credentials וה-adapter נוספים ב-`src/lib/auth.ts` בלבד.
 */
export const authConfig = {
  trustHost: true,
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: {
    signIn: "/auth/login",
    error: "/auth/error",
    newUser: "/auth/welcome",
  },
  providers: [
    ...(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
      ? [
          Google({
            clientId: process.env.AUTH_GOOGLE_ID,
            clientSecret: process.env.AUTH_GOOGLE_SECRET,
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
  ],
  callbacks: {
    /**
     * מעביר לטוקן את השדות שהממשק צריך: תפקיד, אימות טלפון ותמונה.
     * `trigger === "update"` מרענן את הטוקן אחרי אימות טלפון או עריכת פרופיל.
     */
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id as string;
        token.role = (user as { role?: string }).role ?? "USER";
        token.phoneVerified = Boolean((user as { verifiedAt?: Date }).verifiedAt);
        token.phone = (user as { phone?: string | null }).phone ?? null;
      }
      if (trigger === "update" && session) {
        const s = session as Record<string, unknown>;
        if (typeof s.name === "string") token.name = s.name;
        if (typeof s.picture === "string") token.picture = s.picture;
        if (typeof s.phone === "string") token.phone = s.phone;
        if (typeof s.phoneVerified === "boolean")
          token.phoneVerified = s.phoneVerified;
        if (typeof s.role === "string") token.role = s.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = (token.role as "USER" | "BUSINESS" | "ADMIN") ?? "USER";
        session.user.phone = (token.phone as string | null) ?? null;
        session.user.phoneVerified = Boolean(token.phoneVerified);
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
