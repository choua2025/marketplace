import { CircleCheck, TriangleAlert } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getActor } from "@/server/auth/session";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BecomeProviderPrompt } from "@/components/provider/become-provider-prompt";

/**
 * Where the email confirmation link lands (already signed in by Better Auth).
 * ?role=provider carries the sign-up choice: the upgrade itself stays a
 * deliberate click (BecomeProviderPrompt), never a side effect of a GET link.
 */
export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; error?: string }>;
}) {
  const [{ role, error }, actor, t, tHeader] = await Promise.all([
    searchParams,
    getActor(),
    getTranslations("auth"),
    getTranslations("header"),
  ]);

  if (error || !actor) {
    return (
      <main className="flex flex-1 items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardContent className="flex flex-col items-center gap-4 py-4 text-center">
            <TriangleAlert className="size-10 text-amber-500" />
            <h1 className="text-xl font-bold">{t("verifyFailedTitle")}</h1>
            <p className="text-sm text-muted-foreground">{t("verifyFailedBody")}</p>
            <Button asChild className="w-full">
              <Link href="/login">{tHeader("login")}</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  const wantsProvider = role === "provider" && actor.role === "customer";

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-4">
      <Card className="w-full max-w-sm">
        <CardContent className="flex flex-col items-center gap-3 py-4 text-center">
          <CircleCheck className="size-10 text-green-600" />
          <h1 className="text-xl font-bold">{t("welcomeTitle")}</h1>
          <p className="text-sm text-muted-foreground">
            {wantsProvider ? t("welcomeProviderBody") : t("welcomeBody")}
          </p>
          {!wantsProvider ? (
            <div className="flex w-full flex-col gap-2">
              {actor.role === "provider" ? (
                <Button asChild className="w-full">
                  <Link href="/dashboard">{t("goDashboard")}</Link>
                </Button>
              ) : (
                <Button asChild className="w-full">
                  <Link href="/search">{tHeader("navFindPro")}</Link>
                </Button>
              )}
              <Button asChild variant="outline" className="w-full">
                <Link href="/">{t("goHome")}</Link>
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
      {wantsProvider ? <BecomeProviderPrompt /> : null}
    </main>
  );
}
