"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Loader2, MailCheck } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AuthHeader, GoogleSection } from "@/components/auth/auth-shared";
import { ResendVerificationButton, welcomePath } from "@/components/auth/resend-verification";

type Role = "customer" | "provider";

const MIN_PASSWORD_LENGTH = 8;

export function RegisterForm({ initialRole = "customer" }: { initialRole?: Role }) {
  const t = useTranslations("login");
  const tAuth = useTranslations("auth");
  const locale = useLocale();
  const [sentTo, setSentTo] = useState<string | null>(null);

  const [role, setRole] = useState<Role>(initialRole);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [emailTaken, setEmailTaken] = useState(false);
  const [loading, setLoading] = useState(false);

  function errorMessage(code: string | undefined, status: number): string {
    if (status === 429) return t("tooManyAttemptsError");
    switch (code) {
      case "USER_ALREADY_EXISTS":
      case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
        return t("emailTakenError");
      case "INVALID_EMAIL":
        return t("invalidEmailError");
      case "PASSWORD_TOO_SHORT":
        return t("passwordHint");
      case "PHONE_REQUIRED":
      case "INVALID_PHONE":
        return t("invalidPhoneError");
      case "PHONE_TAKEN":
        return t("phoneTakenError");
      default:
        return t("registerFailed");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEmailTaken(false);
    setLoading(true);

    const { error: signUpError } = await authClient.signUp.email({
      name: fullName.trim(),
      email: email.trim(),
      password,
      phoneNumber: phone.trim(),
      // The confirmation link logs the user in and lands here; providers
      // finish opening their pro profile on that page.
      callbackURL: welcomePath(locale, role === "provider" ? "provider" : undefined),
    });
    setLoading(false);
    if (signUpError) {
      setError(errorMessage(signUpError.code, signUpError.status));
      setEmailTaken(signUpError.code?.startsWith("USER_ALREADY_EXISTS") ?? false);
      return;
    }
    // No session yet -- the account works once the email is confirmed.
    setSentTo(email.trim());
  }

  if (sentTo) {
    return (
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-4 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <MailCheck className="size-7" />
            </span>
            <h1 className="text-xl font-bold">{tAuth("checkEmailTitle")}</h1>
            <p className="text-sm text-muted-foreground">
              {tAuth("checkEmailBody", { email: sentTo })}
            </p>
            <p className="text-xs text-muted-foreground">{tAuth("checkSpam")}</p>
            <div className="w-full">
              <ResendVerificationButton
                email={sentTo}
                role={role === "provider" ? "provider" : undefined}
              />
            </div>
            <Link href="/login" className="text-sm text-primary underline-offset-4 hover:underline">
              {tAuth("backToLogin")}
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const canSubmit =
    !loading &&
    fullName.trim().length >= 2 &&
    email.trim().length > 0 &&
    password.length >= MIN_PASSWORD_LENGTH &&
    phone.trim().length >= 8;

  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
      <AuthHeader title={t("registerTitle")} subtitle={t("registerSubtitle")} />

      <Card>
        <CardContent className="flex flex-col gap-6">
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium">{t("iAm")}</legend>
              <RadioGroup
                value={role}
                onValueChange={(value) => setRole(value as Role)}
                className="grid grid-cols-2 gap-2"
              >
                {(
                  [
                    { value: "customer", label: t("customer") },
                    { value: "provider", label: t("provider") },
                  ] as const
                ).map((option) => (
                  <label
                    key={option.value}
                    className={cn(
                      "flex cursor-pointer items-center justify-center rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors",
                      "has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary has-[[data-state=checked]]:text-primary-foreground",
                    )}
                  >
                    <RadioGroupItem value={option.value} className="sr-only" />
                    {option.label}
                  </label>
                ))}
              </RadioGroup>
            </fieldset>

            <div className="flex flex-col gap-2">
              <Label htmlFor="fullName">{t("fullNameLabel")}</Label>
              <Input
                id="fullName"
                type="text"
                autoComplete="name"
                placeholder={t("fullNamePlaceholder")}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="h-12"
                required
              />
            </div>

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
              <Label htmlFor="password">{t("passwordLabel")}</Label>
              <Input
                id="password"
                type="password"
                placeholder={t("passwordPlaceholder")}
                minLength={MIN_PASSWORD_LENGTH}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12"
                aria-describedby="password-hint"
                required
              />
              <p id="password-hint" className="text-xs text-muted-foreground">
                {t("passwordHint")}
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="phone">{t("phoneLabel")}</Label>
              <Input
                id="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder={t("phonePlaceholder")}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-12"
                required
              />
            </div>

            {error ? (
              <p className="text-sm text-destructive">
                {error}
                {emailTaken ? (
                  <>
                    {" "}
                    <Link href="/login" className="underline">
                      {t("goToLogin")}
                    </Link>
                  </>
                ) : null}
              </p>
            ) : null}

            <Button type="submit" className="h-12" disabled={!canSubmit}>
              {loading ? <Loader2 className="animate-spin" /> : t("registerAction")}
            </Button>
          </form>

          <GoogleSection />
        </CardContent>
      </Card>

      <p className="text-center text-sm text-muted-foreground">
        {t("haveAccount")}{" "}
        <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          {t("loginAction")}
        </Link>
      </p>
    </div>
  );
}
