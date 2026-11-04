import { getLocale, getTranslations } from "next-intl/server";
import { BadgeCheck, Star } from "lucide-react";
import { Link, redirect } from "@/i18n/navigation";
import { getActor } from "@/server/auth/session";
import { listMyFavorites } from "@/server/services/favorite";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default async function FavoritesPage() {
  const locale = await getLocale();
  const actor = await getActor();
  if (!actor) throw redirect({ href: "/login", locale });

  const [favorites, t, tCommon] = await Promise.all([
    listMyFavorites(actor),
    getTranslations("favorites"),
    getTranslations("common"),
  ]);

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-4 pb-12">
      <h1 className="text-2xl font-bold">{t("pageTitle")}</h1>

      {favorites.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">{t("emptyState")}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {favorites.map((provider) => {
            const priceUnitLabel =
              provider.priceUnit === "hour"
                ? tCommon("priceUnitHour")
                : provider.priceUnit === "day"
                  ? tCommon("priceUnitDay")
                  : tCommon("priceUnitJob");
            const initial = provider.displayName.trim().charAt(0).toUpperCase() || "?";

            return (
              <Link
                key={provider.id}
                href={`/p/${provider.id}`}
                className="flex items-center gap-3 rounded-xl border p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <Avatar size="lg" className="shrink-0">
                  <AvatarImage src={provider.avatarUrl ?? undefined} alt={provider.displayName} />
                  <AvatarFallback>{initial}</AvatarFallback>
                </Avatar>
                <div className="flex flex-1 flex-col gap-0.5">
                  <div className="flex items-center gap-1">
                    <span className="font-medium">{provider.displayName}</span>
                    {provider.isVerified ? <BadgeCheck className="size-4 text-primary" /> : null}
                  </div>
                  <span className="flex items-center gap-0.5 text-sm text-muted-foreground">
                    <Star className="size-3.5 fill-current text-amber-500" /> {provider.ratingAvg} (
                    {provider.ratingCount})
                  </span>
                  {provider.areaLabel ? (
                    <span className="text-xs text-muted-foreground">{provider.areaLabel}</span>
                  ) : null}
                </div>
                <div className="text-right text-sm font-medium whitespace-nowrap">
                  {Number(provider.basePrice).toLocaleString()} {tCommon("currency")}
                  <br />
                  <span className="text-xs text-muted-foreground">{priceUnitLabel}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
