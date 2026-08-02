import type { Metadata } from "next";

import { ProfileForm } from "@/components/my/profile-form";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { computeTrust } from "@/lib/trust";
import { SellerCard } from "@/components/listing/seller-card";

export const metadata: Metadata = {
  title: "הפרופיל שלי",
  robots: { index: false, follow: false },
};

export default async function ProfilePage() {
  const session = await auth();

  const user = await prisma.user.findUnique({
    where: { id: session!.user.id },
    include: { _count: { select: { listings: { where: { status: "ACTIVE" } } } } },
  });
  if (!user) return null;

  const trust = computeTrust({
    createdAt: user.createdAt,
    verifiedAt: user.verifiedAt,
    ratingAvg: user.ratingAvg,
    ratingCount: user.ratingCount,
    dealsCount: user.dealsCount,
    responseMins: user.responseMins,
    role: user.role,
    activeListings: user._count.listings,
  });

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-heading text-2xl font-extrabold">הפרופיל שלי</h1>
        <p className="text-sm text-muted-foreground">
          כך אתם נראים לקונים. פרופיל מלא מגדיל את האמון ואת מספר הפניות.
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <ProfileForm
          user={{
            name: user.name,
            email: user.email,
            phone: user.phone,
            phoneVerified: Boolean(user.verifiedAt),
            bio: user.bio ?? "",
            avatar: user.avatar ?? "",
            role: user.role,
            businessName: user.businessName ?? "",
            businessAbout: user.businessAbout ?? "",
            businessCity: user.businessCity ?? "",
          }}
        />

        <div>
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">
            תצוגה מקדימה בדף מודעה
          </h2>
          <SellerCard
            seller={{
              id: user.id,
              name: user.name,
              avatar: user.avatar,
              bio: user.bio,
              businessName: user.businessName,
              businessSlug: user.businessSlug,
              createdAt: user.createdAt.toISOString(),
              activeListings: user._count.listings,
            }}
            trust={trust}
          />
        </div>
      </div>
    </div>
  );
}
