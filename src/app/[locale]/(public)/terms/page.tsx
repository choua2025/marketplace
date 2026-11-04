import { getTranslations } from "next-intl/server";

const SECTION_KEYS = ["s1", "s2", "s3", "s4", "s5", "s6"] as const;

export default async function TermsPage() {
  const t = await getTranslations("legal.terms");

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-4 pb-12">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p className="text-sm text-muted-foreground">{t("intro")}</p>
      <div className="flex flex-col gap-4">
        {SECTION_KEYS.map((key) => (
          <section key={key}>
            <h2 className="mb-1 font-semibold">{t(`${key}Title`)}</h2>
            <p className="text-sm text-muted-foreground">{t(`${key}Body`)}</p>
          </section>
        ))}
      </div>
    </main>
  );
}
