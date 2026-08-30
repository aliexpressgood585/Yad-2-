"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import {
  Bell,
  Heart,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  Search as SearchIcon,
  Shield,
  User as UserIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/misc";
import { Skeleton } from "@/components/ui/skeleton";
import { useT } from "@/i18n/client";

export function HeaderUserMenu() {
  const { data: session, status } = useSession();
  const { t } = useT();

  if (status === "loading") {
    return <Skeleton className="size-9 rounded-full" />;
  }

  if (!session?.user) {
    return (
      <Button asChild variant="ghost" size="sm">
        <Link href="/auth/login">
          <UserIcon aria-hidden />
          {/*
           * `sr-only` ולא `hidden` בנייד.
           *
           * `hidden` מסיר את המילה גם מעץ הנגישות, והאייקון לצידה
           * הוא `aria-hidden` — כלומר בנייד הקישור נשאר בלי שם קריא
           * בכלל, וקורא מסך מקריא "קישור". Lighthouse תפס את זה
           * כ-`link-name`, ובאתר אמיתי זה קישור שאי אפשר להשתמש בו.
           */}
          <span className="sr-only sm:not-sr-only">{t("auth.login")}</span>
        </Link>
      </Button>
    );
  }

  const user = session.user;
  const initials = (user.name ?? t("user.anonymous")).trim().charAt(0);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label={t("user.myMenu")}
        >
          <Avatar className="size-9">
            {user.image ? <AvatarImage src={user.image} alt="" /> : null}
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuLabel className="text-sm font-semibold text-foreground">
          {user.name}
          {user.phone ? (
            <span className="block text-xs font-normal text-muted-foreground num">
              {user.phone}
            </span>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/my">
            <LayoutDashboard aria-hidden />  {t("nav.myListings")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/my/favorites">
            <Heart aria-hidden />  {t("nav.favorites")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/my/searches">
            <SearchIcon aria-hidden />  {t("nav.savedSearches")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/my/messages">
            <MessageCircle aria-hidden />  {t("nav.messages")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/my/notifications">
            <Bell aria-hidden />  {t("nav.notifications")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/my/profile">
            <UserIcon aria-hidden />  {t("nav.myProfile")}
          </Link>
        </DropdownMenuItem>
        {user.role === "ADMIN" ? (
          <DropdownMenuItem asChild>
            <Link href="/admin">
              <Shield aria-hidden />  {t("nav.adminPanel")}
            </Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem destructive onClick={() => void signOut({ callbackUrl: "/" })}>
          <LogOut aria-hidden />  {t("auth.logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
