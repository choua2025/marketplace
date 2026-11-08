import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { loginHref } from "@/lib/login-next";
import { getActor } from "@/server/auth/session";
import { getMyPersonalInfo } from "@/server/services/profile";
import { getSignedImageUrl } from "@/server/services/upload";
import { AvatarUploader } from "@/components/profile/avatar-uploader";
import { PersonalInfoForm } from "@/components/profile/personal-info-form";
import { HomepagePhotoToggle } from "@/components/profile/homepage-photo-toggle";

export default async function MyProfilePage() {
  const locale = await getLocale();
  const actor = await getActor();
  if (!actor) throw redirect({ href: loginHref("/profile"), locale });
  // Providers edit the same details, plus their business profile, on their own page.
  if (actor.role === "provider") throw redirect({ href: "/dashboard/profile", locale });

  const [personal, t] = await Promise.all([getMyPersonalInfo(actor), getTranslations("account")]);
  const avatarUrl = await getSignedImageUrl(personal.avatarKey);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-4 pb-12">
      <h1 className="text-2xl font-bold">{t("pageTitle")}</h1>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t("personalInfoTitle")}</h2>
        <div className="flex flex-col gap-6 rounded-lg border p-4 sm:flex-row">
          <AvatarUploader avatarUrl={avatarUrl} fullName={personal.fullName} />
          <PersonalInfoForm
            initialFullName={personal.fullName}
            email={personal.email}
            initialPhone={personal.phone}
            initialLineId={personal.lineId}
            audience="customer"
          />
        </div>
        <HomepagePhotoToggle initialValue={personal.showOnHomepage} />
      </section>
    </main>
  );
}
