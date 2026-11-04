"use client";

import { ClipboardList, Menu, MessageCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { UnreadBadge, useUnreadMessages } from "@/components/layout/unread-messages";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Icons are picked by name: the header is a Server Component and can't pass
// icon components (functions) to these client components.
const NAV_ICONS = {
  bookings: ClipboardList,
  messages: MessageCircle,
};

export interface NavItem {
  href: string;
  label: string;
  icon?: keyof typeof NAV_ICONS;
  /** Show the unread-messages count (from UnreadMessagesProvider) on this item. */
  showUnread?: boolean;
}

function NavIcon({ name, className }: { name: NavItem["icon"]; className?: string }) {
  if (!name) return null;
  const Icon = NAV_ICONS[name];
  return <Icon className={cn("size-4 shrink-0", className)} aria-hidden />;
}

function isActive(pathname: string, href: string) {
  const path = href.split("?")[0]!;
  return pathname === path || pathname.startsWith(`${path}/`);
}

/** Desktop navigation links with the current page highlighted. */
export function HeaderNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="hidden items-center gap-1 md:flex">
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <NavIcon name={item.icon} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Icon buttons beside the profile picture (My bookings, Messages); phones get them in MobileNav. */
export function HeaderShortcuts({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const t = useTranslations("header");
  const unread = useUnreadMessages();
  return (
    <div className="hidden items-center gap-0.5 sm:flex">
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        const count = item.showUnread ? unread : 0;
        const label = count > 0 ? `${item.label} (${t("unreadCount", { count })})` : item.label;
        return (
          <Button
            key={item.href}
            asChild
            variant="ghost"
            size="icon"
            className={cn("relative", active && "bg-primary/10 text-primary hover:bg-primary/15")}
          >
            <Link
              href={item.href}
              aria-label={label}
              title={label}
              aria-current={active ? "page" : undefined}
            >
              <NavIcon name={item.icon} className="size-5" />
              <UnreadBadge count={count} className="absolute -top-0.5 -right-0.5" />
            </Link>
          </Button>
        );
      })}
    </div>
  );
}

/** Phone-size menu: the same links, plus log in / sign up when signed out. */
export function MobileNav({
  items,
  shortcutItems = [],
  authItems,
}: {
  items: NavItem[];
  /** HeaderShortcuts items, listed here only where those buttons are hidden (below `sm`). */
  shortcutItems?: NavItem[];
  authItems: NavItem[];
}) {
  const t = useTranslations("header");
  const unreadMessages = useUnreadMessages();
  const unread = shortcutItems.some((item) => item.showUnread) ? unreadMessages : 0;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative md:hidden"
          aria-label={
            unread > 0 ? `${t("openMenu")} (${t("unreadCount", { count: unread })})` : t("openMenu")
          }
        >
          <Menu className="size-5" />
          {/* Phones only: the Messages icon (and its badge) is inside this menu there. */}
          {unread > 0 ? (
            <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-destructive ring-2 ring-background sm:hidden" />
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {shortcutItems.map((item) => (
          <DropdownMenuItem key={item.href} asChild className="sm:hidden">
            <Link href={item.href}>
              <NavIcon name={item.icon} />
              {item.label}
              {item.showUnread ? <UnreadBadge count={unread} className="ml-auto ring-0" /> : null}
            </Link>
          </DropdownMenuItem>
        ))}
        {items.map((item) => (
          <DropdownMenuItem key={item.href} asChild>
            <Link href={item.href}>
              <NavIcon name={item.icon} />
              {item.label}
            </Link>
          </DropdownMenuItem>
        ))}
        {authItems.length > 0 ? (
          <>
            <DropdownMenuSeparator />
            {authItems.map((item) => (
              <DropdownMenuItem key={item.href} asChild>
                <Link href={item.href}>{item.label}</Link>
              </DropdownMenuItem>
            ))}
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
