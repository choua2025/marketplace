"use client";

import { Briefcase, ClipboardList, Menu, MessageCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { CountBadge, useHeaderCounts, type HeaderBadge } from "@/components/layout/header-counts";
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
  jobs: Briefcase,
  messages: MessageCircle,
};

export interface NavItem {
  href: string;
  label: string;
  icon?: keyof typeof NAV_ICONS;
  /** Which HeaderCountsProvider count to show as a badge on this item. */
  badge?: HeaderBadge;
}

function NavIcon({ name, className }: { name: NavItem["icon"]; className?: string }) {
  if (!name) return null;
  const Icon = NAV_ICONS[name];
  return <Icon className={cn("size-4 shrink-0", className)} aria-hidden />;
}

/** The item's count, and its label with the count spelled out for screen readers. */
function useBadge() {
  const t = useTranslations("header");
  const counts = useHeaderCounts();
  return (item: NavItem) => {
    const count = item.badge ? counts[item.badge] : 0;
    if (count <= 0) return { count, label: item.label };
    const detail =
      item.badge === "pendingBookings"
        ? t("pendingCount", { count })
        : t("unreadCount", { count });
    return { count, label: `${item.label} (${detail})` };
  };
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

/**
 * Icon buttons beside the profile picture (My bookings, Messages); phones get them in MobileNav.
 * They toggle: clicking the one whose section you're in takes you back to the home page.
 */
export function HeaderShortcuts({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const badge = useBadge();

  function handleClick(e: React.MouseEvent<HTMLAnchorElement>, href: string) {
    // Only on the item's own page: from a page inside it (e.g. one booking,
    // or the provider's profile editor) the icon leads back to that page.
    if (pathname !== href) return;
    // Let ctrl/cmd/shift/middle clicks open the link in a new tab as usual.
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    router.push("/");
  }

  return (
    <div className="hidden items-center gap-0.5 sm:flex">
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        const { count, label } = badge(item);
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
              onClick={(e) => handleClick(e, item.href)}
            >
              <NavIcon name={item.icon} className="size-5" />
              <CountBadge count={count} className="absolute -top-0.5 -right-0.5" />
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
  const badge = useBadge();
  const hasNews = shortcutItems.some((item) => badge(item).count > 0);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative md:hidden"
          aria-label={hasNews ? `${t("openMenu")} (${t("menuHasNews")})` : t("openMenu")}
        >
          <Menu className="size-5" />
          {/* Phones only: the shortcut icons (and their badges) are inside this menu there. */}
          {hasNews ? (
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
              <CountBadge count={badge(item).count} className="ml-auto ring-0" />
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
