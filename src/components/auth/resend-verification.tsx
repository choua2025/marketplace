"use client";

import { useState } from "react";
import { Loader2, MailCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { getPathname } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

/** Where the confirmation link lands, in the current language. */
export function welcomePath(locale: string, role?: "provider"): string {
  return getPathname({
    href: role ? { pathname: "/welcome", query: { role } } : "/welcome",
    locale,
  });
}

export function ResendVerificationButton({ email, role }: { email: string; role?: "provider" }) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error" | "limited">("idle");

  async function resend() {
    setState("sending");
    const { error } = await authClient.sendVerificationEmail({
      email,
      callbackURL: welcomePath(locale, role),
    });
    setState(!error ? "sent" : error.status === 429 ? "limited" : "error");
  }

  if (state === "sent") {
    return (
      <p className="flex items-center gap-2 text-sm text-green-600">
        <MailCheck className="size-4" /> {t("verificationResent")}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" variant="outline" disabled={state === "sending"} onClick={resend}>
        {state === "sending" ? <Loader2 className="animate-spin" /> : t("resendVerification")}
      </Button>
      {state === "error" ? <p className="text-sm text-destructive">{t("genericError")}</p> : null}
      {state === "limited" ? (
        <p className="text-sm text-destructive">{t("tooManyRequests")}</p>
      ) : null}
    </div>
  );
}
