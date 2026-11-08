import { getTranslations } from "next-intl/server";
import { SearchX } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

/** 404 for pages that call notFound() and for unknown URLs (see [...rest]/page.tsx). */
export default async function NotFound() {
  const t = await getTranslations("notFoundPage");

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="flex w-full max-w-sm flex-col items-center gap-4 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <SearchX className="size-7" aria-hidden />
        </span>
        <p className="text-sm font-semibold text-primary">404</p>
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("body")}</p>
        <div className="flex w-full flex-col gap-2">
          <Button asChild className="h-12">
            <Link href="/search">{t("search")}</Link>
          </Button>
          <Button asChild variant="ghost" className="h-12">
            <Link href="/">{t("home")}</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
