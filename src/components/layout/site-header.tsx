import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getActor } from "@/server/auth/session";
import { getActorSummary } from "@/server/services/profile";
import { getSignedImageUrl } from "@/server/services/upload";
import { countUnreadMessages } from "@/server/services/chat-read";
import { UnreadMessagesProvider } from "@/components/layout/unread-messages";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { UserMenu } from "@/components/layout/user-menu";
import {
  HeaderNav,
  HeaderShortcuts,
  MobileNav,
  type NavItem,
} from "@/components/layout/header-nav";

export async function SiteHeader() {
  const [actor, t, tCommon, tUser] = await Promise.all([
    getActor(),
    getTranslations("header"),
    getTranslations("common"),
    getTranslations("userMenu"),
  ]);
  const hasMessages = actor !== null && actor.role !== "admin";
  const [summary, unreadCount] = await Promise.all([
    getActorSummary(actor),
    hasMessages ? countUnreadMessages(actor) : 0,
  ]);
  const avatarUrl = summary ? await getSignedImageUrl(summary.avatarKey) : null;
  const brand = tCommon("brand");

  const navItems: NavItem[] = [
    { href: "/search", label: t("navFindPro") },
    // Only worth showing to people who aren't providers (or admins) already.
    ...(!actor || actor.role === "customer"
      ? [{ href: "/register?role=provider", label: t("navBecomeProvider") }]
      : []),
    { href: "/help", label: t("navHelp") },
  ];
  // Icon buttons next to the profile picture.
  const shortcutItems: NavItem[] = [
    ...(actor?.role === "customer"
      ? [{ href: "/bookings", label: tUser("myBookings"), icon: "bookings" as const }]
      : []),
    ...(hasMessages
      ? [
          {
            href: "/messages",
            label: tUser("messages"),
            icon: "messages" as const,
            showUnread: true,
          },
        ]
      : []),
  ];
  const authItems: NavItem[] = actor
    ? []
    : [
        { href: "/login", label: t("login") },
        { href: "/register", label: t("register") },
      ];

  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-heading text-lg font-bold">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm text-primary-foreground shadow-sm">
            {brand.charAt(0)}
          </span>
          <span>{brand}</span>
        </Link>

        <HeaderNav items={navItems} />

        <MaybeUnreadProvider enabled={hasMessages} initialCount={unreadCount}>
          <div className="ml-auto flex items-center gap-1.5">
            <ThemeToggle />
            <LocaleSwitcher />
            {actor && summary ? (
              <>
                <HeaderShortcuts items={shortcutItems} />
                <UserMenu fullName={summary.fullName} role={actor.role} avatarUrl={avatarUrl} />
              </>
            ) : (
              <div className="hidden items-center gap-1.5 sm:flex">
                <Button asChild variant="ghost">
                  <Link href="/login">{t("login")}</Link>
                </Button>
                <Button asChild>
                  <Link href="/register">{t("register")}</Link>
                </Button>
              </div>
            )}
            <MobileNav items={navItems} shortcutItems={shortcutItems} authItems={authItems} />
          </div>
        </MaybeUnreadProvider>
      </div>
    </header>
  );
}

/** Only signed-in customers/providers poll for unread messages. */
function MaybeUnreadProvider({
  enabled,
  initialCount,
  children,
}: {
  enabled: boolean;
  initialCount: number;
  children: React.ReactNode;
}) {
  if (!enabled) return children;
  return <UnreadMessagesProvider initialCount={initialCount}>{children}</UnreadMessagesProvider>;
}
