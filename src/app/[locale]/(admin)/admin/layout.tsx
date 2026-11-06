import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { loginHref } from "@/lib/login-next";
import { getActor } from "@/server/auth/session";
import { getActorSummary } from "@/server/services/profile";
import { getSignedImageUrl } from "@/server/services/upload";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminSearch } from "@/components/admin/admin-search";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { UserMenu } from "@/components/layout/user-menu";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const actor = await getActor();
  if (!actor) throw redirect({ href: loginHref("/admin"), locale });
  // Admin is never self-service (SPEC.md section 7.1 extended to this
  // role too) -- a non-admin just gets sent home, no "request access" UI.
  if (actor.role !== "admin") throw redirect({ href: "/", locale });

  const [t, tCommon, summary] = await Promise.all([
    getTranslations("admin"),
    getTranslations("common"),
    getActorSummary(actor),
  ]);
  const avatarUrl = summary ? await getSignedImageUrl(summary.avatarKey) : null;
  const brand = tCommon("brand");

  const brandMark = (
    <Link href="/admin" className="flex items-center gap-2 font-heading font-bold">
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm text-primary-foreground">
        {brand.charAt(0)}
      </span>
      <span className="flex flex-col leading-tight">
        <span>{brand}</span>
        <span className="text-xs font-normal text-muted-foreground">{t("panelLabel")}</span>
      </span>
    </Link>
  );

  return (
    <div className="flex min-h-screen flex-1 bg-muted/30">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-6 border-r bg-background p-4 md:flex">
        {brandMark}
        <AdminNav orientation="vertical" />
        <Link
          href="/"
          className="mt-auto flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {t("backToSite")}
        </Link>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
          <div className="flex h-14 items-center gap-3 px-4 md:px-6">
            <div className="md:hidden">{brandMark}</div>
            <div className="hidden flex-1 sm:block">
              <Suspense>
                <AdminSearch />
              </Suspense>
            </div>
            <div className="ml-auto flex items-center gap-1">
              <ThemeToggle />
              <LocaleSwitcher />
              {summary ? (
                <UserMenu fullName={summary.fullName} role={actor.role} avatarUrl={avatarUrl} />
              ) : null}
            </div>
          </div>
          <div className="px-4 pb-3 sm:hidden">
            <Suspense>
              <AdminSearch />
            </Suspense>
          </div>
          <div className="md:hidden">
            <AdminNav orientation="horizontal" />
          </div>
        </header>

        <main className="flex flex-1 flex-col gap-6 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
