import { getTranslations } from "next-intl/server";

export default async function ContactPage() {
  const t = await getTranslations("legal.contact");

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-4 pb-12">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p className="text-sm text-muted-foreground">{t("body")}</p>
      <div className="rounded-lg border p-4 shadow-sm">
        <p className="text-xs text-muted-foreground">{t("emailLabel")}</p>
        <a href={`mailto:${t("email")}`} className="font-medium text-primary hover:underline">
          {t("email")}
        </a>
      </div>
    </main>
  );
}
