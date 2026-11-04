"use client";

import { useState } from "react";
import { Loader2, MailCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { getPathname, Link } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthHeader } from "@/components/auth/auth-shared";

export function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const tLogin = useTranslations("login");
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setState("sending");
    const { error: requestError } = await authClient.requestPasswordReset({
      email: email.trim(),
      // The emailed link lands on our reset page, in the current language.
      redirectTo: getPathname({ href: "/reset-password", locale }),
    });
    if (requestError) {
      setState("idle");
      setError(requestError.status === 429 ? t("tooManyRequests") : t("genericError"));
      return;
    }
    // Same message whether or not the email has an account.
    setState("sent");
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
      <AuthHeader title={t("forgotTitle")} subtitle={t("forgotSubtitle")} />
      <Card>
        <CardContent className="flex flex-col gap-4">
          {state === "sent" ? (
            <div className="flex flex-col items-center gap-3 py-2 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <MailCheck className="size-6" />
              </span>
              <p role="status" className="text-sm text-muted-foreground">
                {t("resetLinkSent")}
              </p>
            </div>
          ) : (
            <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">{tLogin("emailLabel")}</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder={tLogin("emailPlaceholder")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12"
                  required
                />
              </div>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <Button
                type="submit"
                className="h-12"
                disabled={state === "sending" || !email.trim()}
              >
                {state === "sending" ? <Loader2 className="animate-spin" /> : t("sendResetLink")}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
      <Link
        href="/login"
        className="text-center text-sm text-primary underline-offset-4 hover:underline"
      >
        {t("backToLogin")}
      </Link>
    </div>
  );
}
