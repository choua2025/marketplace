"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { Loader2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthHeader, GoogleSection } from "@/components/auth/auth-shared";
import { ResendVerificationButton } from "@/components/auth/resend-verification";

export function LoginForm() {
  const t = useTranslations("login");
  const tAuth = useTranslations("auth");
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notVerified, setNotVerified] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotVerified(false);
    setLoading(true);
    const { error: signInError } = await authClient.signIn.email({
      email: email.trim(),
      password,
    });
    if (signInError) {
      setLoading(false);
      if (signInError.code === "EMAIL_NOT_VERIFIED") {
        setNotVerified(true);
        setError(tAuth("notVerifiedError"));
        return;
      }
      setError(
        signInError.code === "INVALID_EMAIL_OR_PASSWORD"
          ? t("invalidCredentialsError")
          : signInError.status === 429
            ? t("tooManyAttemptsError")
            : t("loginFailed"),
      );
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
      <AuthHeader title={t("loginTitle")} subtitle={t("loginSubtitle")} />

      <Card>
        <CardContent className="flex flex-col gap-6">
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">{t("emailLabel")}</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder={t("emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12"
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="password">{t("passwordLabel")}</Label>
                <Link
                  href="/forgot-password"
                  className="text-sm text-primary underline-offset-4 hover:underline"
                >
                  {tAuth("forgotPasswordLink")}
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                placeholder={t("passwordPlaceholder")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12"
                required
              />
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            {notVerified ? <ResendVerificationButton email={email.trim()} /> : null}

            <Button type="submit" className="h-12" disabled={loading || !email.trim() || !password}>
              {loading ? <Loader2 className="animate-spin" /> : t("loginAction")}
            </Button>
          </form>

          <GoogleSection />
        </CardContent>
      </Card>

      <p className="text-center text-sm text-muted-foreground">
        {t("noAccount")}{" "}
        <Link
          href="/register"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          {t("registerAction")}
        </Link>
      </p>
    </div>
  );
}
