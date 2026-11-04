import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getActor } from "@/server/auth/session";
import { getMyProviderDashboard } from "@/server/services/provider";
import { getMyPersonalInfo } from "@/server/services/profile";
import { listCategories } from "@/server/services/category";
import { getSignedImageUrl } from "@/server/services/upload";
import { BecomeProviderPrompt } from "@/components/provider/become-provider-prompt";
import { AvatarUploader } from "@/components/profile/avatar-uploader";
import { PersonalInfoForm } from "@/components/profile/personal-info-form";
import { ProviderProfileForm } from "@/components/provider/provider-profile-form";
import { AvailabilityEditor } from "@/components/provider/availability-editor";
import { PortfolioManager } from "@/components/provider/portfolio-manager";

export default async function ProviderProfilePage() {
  const actor = await getActor();
  if (!actor) throw redirect({ href: "/login", locale: await getLocale() });

  if (actor.role !== "provider") {
    return (
      <main className="flex flex-1 items-center justify-center p-4">
        <BecomeProviderPrompt />
      </main>
    );
  }

  const [dashboard, personal, allCategories, t, tAccount] = await Promise.all([
    getMyProviderDashboard(actor),
    getMyPersonalInfo(actor),
    listCategories(actor),
    getTranslations("dashboard"),
    getTranslations("account"),
  ]);

  const [avatarUrl, portfolio] = await Promise.all([
    getSignedImageUrl(personal.avatarKey),
    Promise.all(
      dashboard.portfolio.map(async (item) => ({
        id: item.id,
        caption: item.caption,
        url: await getSignedImageUrl(item.imageKey),
      })),
    ),
  ]);

  return (
    <main className="mx-auto flex max-w-3xl flex-1 flex-col gap-8 p-4 pb-12">
      <h1 className="text-2xl font-bold">{t("editProfileTitle")}</h1>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{tAccount("personalInfoTitle")}</h2>
        <div className="flex flex-col gap-6 rounded-lg border p-4 sm:flex-row">
          <AvatarUploader avatarUrl={avatarUrl} fullName={personal.fullName} />
          <PersonalInfoForm
            initialFullName={personal.fullName}
            email={personal.email}
            initialPhone={personal.phone}
            initialLineId={personal.lineId}
            audience="provider"
          />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t("shopProfileTitle")}</h2>
        <ProviderProfileForm
          initialProfile={dashboard.profile}
          initialCategorySlugs={dashboard.categorySlugs}
          allCategories={allCategories}
        />
      </section>

      <PortfolioManager initialPortfolio={portfolio} />
      <AvailabilityEditor initialAvailability={dashboard.availability} />
    </main>
  );
}
