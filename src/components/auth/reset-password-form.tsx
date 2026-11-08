"use client";

import { useState } from "react";
import { CircleCheck, Loader2, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { AuthHeader } from "@/components/auth/auth-shared";

const MIN_PASSWORD_LENGTH = 8;

function StatusCard({
  tone,
  message,
  linkHref,
  linkLabel,
}: {
  tone: "success" | "error";
  message: string;
  linkHref: string;
  linkLabel: string;
}) {
  const Icon = tone === "success" ? CircleCheck : TriangleAlert;
  return (
    <Card className="w-full max-w-sm">
      <CardContent className="flex flex-col items-center gap-4 py-4 text-center">
        <Icon
          className={tone === "success" ? "size-10 text-green-600" : "size-10 text-amber-500"}
        />
        <p role="status" className="text-sm text-muted-foreground">
          {message}
        </p>
        <Button asChild className="w-full">
          <Link href={linkHref}>{linkLabel}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

/** `token` comes from the emailed link; `linkError` is set when that link was already invalid. */
export function ResetPasswordForm({ token, linkError }: { token?: string; linkError?: boolean }) {
  const t = useTranslations("auth");
  const tLogin = useTranslations("login");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "done" | "invalid">(
    !token || linkError ? "invalid" : "idle",
  );
  const [error, setError] = useState<string | null>(null);

  const mismatch = confirm.length > 0 && confirm !== password;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || mismatch) return;
    setError(null);
    setState("saving");
    const { error: resetError } = await authClient.resetPassword({ newPassword: password, token });
    if (!resetError) {
      setState("done");
      return;
    }
    if (resetError.code === "INVALID_TOKEN") {
      setState("invalid");
      return;
    }
    setState("idle");
    setError(resetError.status === 429 ? t("tooManyRequests") : t("genericError"));
  }

  if (state === "done") {
    return (
      <StatusCard
        tone="success"
        message={t("resetDone")}
        linkHref="/login"
        linkLabel={tLogin("loginAction")}
      />
    );
  }
  if (state === "invalid") {
    return (
      <StatusCard
        tone="error"
        message={t("resetInvalidLink")}
        linkHref="/forgot-password"
        linkLabel={t("requestNewLink")}
      />
    );
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
      <AuthHeader title={t("resetTitle")} subtitle={t("resetSubtitle")} />
      <Card>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="newPassword">{t("newPasswordLabel")}</Label>
              <PasswordInput
                id="newPassword"
                autoComplete="new-password"
                minLength={MIN_PASSWORD_LENGTH}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12"
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="confirmPassword">{t("confirmPasswordLabel")}</Label>
              <PasswordInput
                id="confirmPassword"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                aria-invalid={mismatch || undefined}
                className="h-12"
                required
              />
              {mismatch ? (
                <p className="text-xs text-destructive">{t("passwordsDontMatch")}</p>
              ) : null}
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button
              type="submit"
              className="h-12"
              disabled={
                state === "saving" || password.length < MIN_PASSWORD_LENGTH || confirm !== password
              }
            >
              {state === "saving" ? <Loader2 className="animate-spin" /> : t("resetSubmit")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
