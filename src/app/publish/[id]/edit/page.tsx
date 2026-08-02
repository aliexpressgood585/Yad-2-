import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { PublishWizard } from "@/components/publish/publish-wizard";
import { auth } from "@/lib/auth";
import { getCategoryTree } from "@/lib/categories";
import { prisma } from "@/lib/db";

export const metadata: Metadata = {
  title: "עריכת מודעה",
  robots: { index: false, follow: false },
};

export default async function EditListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/auth/login?callbackUrl=/publish/${id}/edit`);

  const listing = await prisma.listing.findFirst({
    where: { id, userId: session.user.id, deletedAt: null },
    include: {
      images: { orderBy: { order: "asc" } },
      attributes: { include: { attribute: true, value: true } },
    },
  });
  if (!listing) notFound();

  // ערכי השדות הדינמיים מקובצים לפי מפתח; MULTISELECT מקבל מערך
  const attributes: Record<string, string | number | boolean | string[]> = {};
  for (const a of listing.attributes) {
    const key = a.attribute.key;
    const value =
      a.valueBool !== null
        ? a.valueBool
        : a.valueNumber !== null
          ? a.valueNumber
          : (a.valueText ?? "");

    if (a.attribute.type === "MULTISELECT") {
      const current = (attributes[key] as string[] | undefined) ?? [];
      attributes[key] = [...current, String(value)];
    } else {
      attributes[key] = value;
    }
  }

  const tree = await getCategoryTree();

  return (
    <PublishWizard
      tree={tree}
      phoneVerified={session.user.phoneVerified}
      defaultPhone={session.user.phone ?? ""}
      defaultName={session.user.name ?? ""}
      initial={{
        id: listing.id,
        status: listing.status,
        categoryId: listing.categoryId,
        title: listing.title,
        description: listing.description,
        price: listing.price,
        isNegotiable: listing.isNegotiable,
        city: listing.city,
        neighborhood: listing.neighborhood ?? "",
        address: listing.address ?? "",
        contactPhone: listing.contactPhone ?? "",
        contactName: listing.contactName ?? "",
        allowChat: listing.allowChat,
        images: listing.images.map((i) => ({
          url: i.url,
          thumbUrl: i.thumbUrl ?? undefined,
          blurhash: i.blurhash ?? undefined,
          width: i.width ?? undefined,
          height: i.height ?? undefined,
          phash: i.phash ?? undefined,
        })),
        attributes,
      }}
    />
  );
}
