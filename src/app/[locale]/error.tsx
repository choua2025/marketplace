"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { TriangleAlert } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

/**
 * Shown when a page fails unexpectedly. No error details are shown to the
 * user (SPEC.md section 11); the digest lets support match the server log.
 */
export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  const t = useTranslations("errorPage");
  const digest =
    error instanceof Error && "digest" in error && typeof error.digest === "string"
      ? error.digest
      : null;

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="flex w-full max-w-sm flex-col items-center gap-4 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <TriangleAlert className="size-7" aria-hidden />
        </span>
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("body")}</p>
        <div className="flex w-full flex-col gap-2">
          <Button className="h-12" onClick={() => retry()}>
            {t("retry")}
          </Button>
          <Button asChild variant="ghost" className="h-12">
            <Link href="/">{t("home")}</Link>
          </Button>
        </div>
        {digest ? (
          <p className="text-xs text-muted-foreground">{t("reference", { digest })}</p>
        ) : null}
      </div>
    </main>
  );
}
