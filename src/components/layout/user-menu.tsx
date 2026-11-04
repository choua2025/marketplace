"use client";

import { Heart, LayoutDashboard, LogOut, ShieldCheck, UserPen } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import type { Role } from "@/server/lib/actor";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface UserMenuProps {
  fullName: string;
  role: Role;
  avatarUrl: string | null;
}

export function UserMenu({ fullName, role, avatarUrl }: UserMenuProps) {
  const t = useTranslations("userMenu");
  const tHeader = useTranslations("header");
  const router = useRouter();
  const initial = fullName.trim().charAt(0).toUpperCase() || "?";

  const roleLabel =
    role === "provider" ? t("roleProvider") : role === "admin" ? t("roleAdmin") : t("roleCustomer");

  async function handleLogout() {
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="focus-visible:ring-ring/50 rounded-full focus-visible:ring-3 focus-visible:outline-none"
        aria-label={tHeader("accountMenuLabel")}
      >
        <Avatar>
          <AvatarImage src={avatarUrl ?? undefined} alt={fullName} />
          <AvatarFallback>{initial}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="truncate text-sm font-medium text-foreground">{fullName}</span>
          <span className="text-xs text-muted-foreground">{roleLabel}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {role === "admin" ? (
          <>
            <DropdownMenuItem asChild>
              <Link href="/admin">
                <ShieldCheck /> {t("adminDashboard")}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/profile">
                <UserPen /> {t("myProfile")}
              </Link>
            </DropdownMenuItem>
          </>
        ) : role === "provider" ? (
          <>
            <DropdownMenuItem asChild>
              <Link href="/dashboard">
                <LayoutDashboard /> {t("dashboard")}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/dashboard/profile">
                <UserPen /> {t("editProfile")}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/dashboard/verification">
                <ShieldCheck /> {t("verification")}
              </Link>
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuItem asChild>
              <Link href="/profile">
                <UserPen /> {t("myProfile")}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/favorites">
                <Heart /> {t("myFavorites")}
              </Link>
            </DropdownMenuItem>
          </>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={handleLogout}>
          <LogOut /> {t("logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
