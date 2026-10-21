import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getActor } from "@/server/auth/session";
import { getMyProviderDashboard } from "@/server/services/provider";
import { listCategories } from "@/server/services/category";
import { getSignedImageUrl } from "@/server/services/upload";
import { BecomeProviderPrompt } from "@/components/provider/become-provider-prompt";
import { ProviderProfileForm } from "@/components/provider/provider-profile-form";
import { AvailabilityEditor } from "@/components/provider/availability-editor";
import { PortfolioManager } from "@/components/provider/portfolio-manager";

export default async function ProviderProfilePage() {
  const actor = await getActor();
  if (!actor) throw redirect({ href: "/login", locale: await getLocale() });

  if (actor.role !== "provider") {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <BecomeProviderPrompt />
      </main>
    );
  }

  const [dashboard, allCategories] = await Promise.all([
    getMyProviderDashboard(actor),
    listCategories(actor),
  ]);

  const [avatarUrl, portfolio] = await Promise.all([
    getSignedImageUrl(dashboard.avatarKey),
    Promise.all(
      dashboard.portfolio.map(async (item) => ({
        id: item.id,
        caption: item.caption,
        url: await getSignedImageUrl(item.imageKey),
      })),
    ),
  ]);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-4">
      <h1 className="text-2xl font-bold">แก้ไขโปรไฟล์ช่าง</h1>
      <PortfolioManager avatarUrl={avatarUrl} initialPortfolio={portfolio} />
      <ProviderProfileForm
        initialProfile={dashboard.profile}
        initialCategorySlugs={dashboard.categorySlugs}
        allCategories={allCategories}
      />
      <AvailabilityEditor initialAvailability={dashboard.availability} />
    </main>
  );
}
