"use client";

import { useTranslations } from "next-intl";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export function AuthHeader({ title, subtitle }: { title: string; subtitle: string }) {
  const tCommon = useTranslations("common");
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <span className="flex size-12 items-center justify-center rounded-xl bg-primary text-xl font-bold text-primary-foreground">
        {tCommon("brand").charAt(0)}
      </span>
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="text-sm text-muted-foreground">{subtitle}</p>
    </div>
  );
}

export function GoogleSection() {
  const t = useTranslations("login");
  return (
    <>
      <div className="flex items-center gap-2">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">{t("or")}</span>
        <div className="h-px flex-1 bg-border" />
      </div>
      <Button
        type="button"
        variant="outline"
        className="h-12"
        onClick={() => authClient.signIn.social({ provider: "google", callbackURL: "/" })}
      >
        {t("googleLogin")}
      </Button>
    </>
  );
}
