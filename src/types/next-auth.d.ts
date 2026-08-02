import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "USER" | "BUSINESS" | "ADMIN";
      phone: string | null;
      phoneVerified: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    role?: "USER" | "BUSINESS" | "ADMIN";
    phone?: string | null;
    verifiedAt?: Date | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: "USER" | "BUSINESS" | "ADMIN";
    phone: string | null;
    phoneVerified: boolean;
  }
}
