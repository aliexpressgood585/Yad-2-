import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PublishWizard } from "@/components/publish/publish-wizard";
import { auth } from "@/lib/auth";
import { getCategoryTree } from "@/lib/categories";

export const metadata: Metadata = {
  title: "פרסום מודעה",
  description: "פרסום מודעה חינם במציאה — ארבעה שלבים קצרים והמודעה באוויר.",
  robots: { index: false, follow: true },
};

export default async function PublishPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/login?callbackUrl=/publish");

  const tree = await getCategoryTree();

  return (
    <PublishWizard
      tree={tree}
      phoneVerified={session.user.phoneVerified}
      defaultPhone={session.user.phone ?? ""}
      defaultName={session.user.name ?? ""}
    />
  );
}
