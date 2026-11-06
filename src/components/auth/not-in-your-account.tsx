import { getTranslations } from "next-intl/server";
import { SearchX } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { Actor } from "@/server/lib/actor";
import { getMyPersonalInfo } from "@/server/services/profile";
import { SwitchAccountButton } from "@/components/auth/switch-account-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Shown instead of a bare 404 when a signed-in user opens a booking or chat
 * that isn't theirs -- usually an email link opened while signed in to a
 * different account. Worded the same whether the item exists or not, so it
 * doesn't reveal other people's bookings.
 */
export async function NotInYourAccount({ actor, path }: { actor: Actor; path: string }) {
  const [t, personal] = await Promise.all([
    getTranslations("wrongAccount"),
    getMyPersonalInfo(actor),
  ]);

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardContent className="flex flex-col items-center gap-4 py-2 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <SearchX className="size-6" aria-hidden />
          </span>
          <h1 className="text-lg font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("signedInAs")}</p>
          <p className="max-w-full truncate rounded-md bg-muted px-3 py-1.5 text-sm font-medium">
            {personal.email}
          </p>
          <p className="text-sm text-muted-foreground">{t("hint")}</p>
          <SwitchAccountButton next={path} />
          <Button asChild variant="ghost" className="w-full">
            <Link href="/">{t("home")}</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
