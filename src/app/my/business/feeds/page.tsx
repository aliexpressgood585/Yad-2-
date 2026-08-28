import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { FeedManager, type FeedRow } from "@/components/business/feed-manager";
import { auth } from "@/lib/auth";
import { activeMembership, permissionsFor } from "@/lib/business";
import { getAttributesForCategory, getCategoryPath, getCategoryTree, type CategoryNode } from "@/lib/categories";
import { prisma } from "@/lib/db";

export const metadata: Metadata = {
  title: "פידים",
  robots: { index: false, follow: false },
};

function leaves(nodes: CategoryNode[], prefix = ""): { id: string; path: string }[] {
  return nodes.flatMap((node) => {
    const path = prefix ? `${prefix} › ${node.name}` : node.name;
    return node.children.length ? leaves(node.children, path) : [{ id: node.id, path }];
  });
}

export default async function FeedsPage() {
  const session = await auth();
  const membership = await activeMembership(session!.user.id);
  if (!membership || !permissionsFor(membership.role).importInventory) {
    redirect("/my/business");
  }

  const [tree, feeds] = await Promise.all([
    getCategoryTree(),
    prisma.listingFeed.findMany({
      where: { businessId: membership.businessId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const categories = leaves(tree);
  const attributesByCategory = Object.fromEntries(
    await Promise.all(
      categories.map(async (c) => [
        c.id,
        (await getAttributesForCategory(c.id)).map((a) => ({
          key: a.key,
          label: a.label,
          isRequired: a.isRequired,
        })),
      ]),
    ),
  );

  const rows: FeedRow[] = await Promise.all(
    feeds.map(async (f) => ({
      id: f.id,
      name: f.name,
      url: f.url,
      format: f.format,
      categoryPath: (await getCategoryPath(f.categoryId)).map((c) => c.name).join(" › "),
      isActive: f.isActive,
      removeMissing: f.removeMissing,
      lastRunAt: f.lastRunAt?.toISOString() ?? null,
      lastStatus: f.lastStatus,
      lastMessage: f.lastMessage,
    })),
  );

  return (
    <FeedManager
      feeds={rows}
      categories={categories}
      attributesByCategory={attributesByCategory}
    />
  );
}
