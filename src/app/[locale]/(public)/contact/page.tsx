import { getTranslations } from "next-intl/server";
import { env } from "@/server/lib/env";

export default async function ContactPage() {
  const t = await getTranslations("legal.contact");
  // Set per deployment (SUPPORT_EMAIL), not in the translations, so a real
  // address never has to be committed and each environment can use its own.
  const email = env.SUPPORT_EMAIL;

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-4 pb-12">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p className="text-sm text-muted-foreground">{t("body")}</p>
      {email ? (
        <div className="rounded-lg border p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">{t("emailLabel")}</p>
          <a href={`mailto:${email}`} className="font-medium text-primary hover:underline">
            {email}
          </a>
        </div>
      ) : null}
    </main>
  );
}
