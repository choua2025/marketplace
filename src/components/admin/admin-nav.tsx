"use client";

import { ClipboardList, LayoutDashboard, Store, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/admin", key: "navOverview", icon: LayoutDashboard },
  { href: "/admin/customers", key: "navCustomers", icon: Users },
  { href: "/admin/providers", key: "navProviders", icon: Store },
  { href: "/admin/bookings", key: "navBookings", icon: ClipboardList },
] as const;

export function AdminNav({ orientation }: { orientation: "vertical" | "horizontal" }) {
  const t = useTranslations("admin");
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/admin"
      ? pathname === "/admin"
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav
      className={cn(
        orientation === "vertical"
          ? "flex flex-col gap-1"
          : "flex gap-1 overflow-x-auto border-b px-4 py-2",
      )}
    >
      {ITEMS.map(({ href, key, icon: Icon }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {t(key)}
          </Link>
        );
      })}
    </nav>
  );
}
