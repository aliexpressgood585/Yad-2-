import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ShieldCheck } from "lucide-react";

import { ChatThread } from "@/components/my/chat-thread";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { truncate } from "@/lib/utils";
import { formatPrice } from "@/lib/format";

export const metadata: Metadata = {
  title: "שיחה",
  robots: { index: false, follow: false },
};

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const userId = session!.user.id;

  const conversation = await prisma.conversation.findFirst({
    where: { id, OR: [{ buyerId: userId }, { sellerId: userId }] },
    include: {
      listing: {
        select: {
          id: true,
          slug: true,
          title: true,
          price: true,
          status: true,
          images: { orderBy: { order: "asc" }, take: 1 },
        },
      },
      buyer: { select: { id: true, name: true, avatar: true } },
      seller: { select: { id: true, name: true, avatar: true } },
      messages: { orderBy: { createdAt: "asc" }, take: 200 },
    },
  });
  if (!conversation) notFound();

  const isSeller = conversation.sellerId === userId;
  const other = isSeller ? conversation.buyer : conversation.seller;
  const image = conversation.listing.images[0];

  // פתיחת השיחה מסמנת אותה כנקראה
  await prisma.conversation.update({
    where: { id },
    data: isSeller ? { sellerReadAt: new Date() } : { buyerReadAt: new Date() },
  });

  return (
    <div className="flex h-[calc(100dvh-12rem)] min-h-[28rem] flex-col">
      <Button asChild variant="ghost" size="sm" className="-ms-2 self-start">
        <Link href="/my/messages">
          <ArrowRight aria-hidden />
          כל ההודעות
        </Link>
      </Button>

      <header className="mt-2 flex items-center gap-3 rounded-t-lg border border-border bg-card p-3">
        <Link
          href={`/item/${conversation.listing.slug}`}
          className="relative size-12 shrink-0 overflow-hidden rounded-md bg-muted"
        >
          {image ? (
            <Image
              src={image.thumbUrl ?? image.url}
              alt=""
              fill
              sizes="48px"
              className="object-cover"
              unoptimized={(image.thumbUrl ?? image.url).startsWith("/uploads")}
            />
          ) : null}
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">
            <Link href={`/item/${conversation.listing.slug}`} className="hover:underline">
              {truncate(conversation.listing.title, 50)}
            </Link>
          </p>
          <p className="text-xs text-muted-foreground">
            <span className="num">{formatPrice(conversation.listing.price)}</span> · שיחה עם{" "}
            <Link href={`/u/${other.id}`} className="hover:underline">
              {other.name}
            </Link>
          </p>
        </div>
      </header>

      <ChatThread
        conversationId={conversation.id}
        currentUserId={userId}
        otherName={other.name}
        initialMessages={conversation.messages.map((m) => ({
          id: m.id,
          body: m.body,
          senderId: m.senderId,
          createdAt: m.createdAt.toISOString(),
        }))}
      />

      <p className="flex items-center gap-2 rounded-b-lg border border-t-0 border-border bg-muted/40 p-2.5 text-xs text-muted-foreground">
        <ShieldCheck className="size-4 shrink-0" aria-hidden />
        לעולם אל תעבירו כסף מראש ואל תמסרו פרטי אשראי או קוד אימות בצ&apos;אט.
      </p>
    </div>
  );
}
