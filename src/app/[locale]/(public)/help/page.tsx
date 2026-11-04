import { getTranslations } from "next-intl/server";

const FAQ_KEYS = ["q1", "q2", "q3", "q4", "q5"] as const;

export default async function HelpPage() {
  const t = await getTranslations("legal.help");

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-4 pb-12">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <div className="flex flex-col gap-4">
        {FAQ_KEYS.map((key) => (
          <section key={key} className="rounded-lg border p-4 shadow-sm">
            <h2 className="mb-1 font-semibold">{t(`${key}Title`)}</h2>
            <p className="text-sm text-muted-foreground">{t(`${key}Body`)}</p>
          </section>
        ))}
      </div>
    </main>
  );
}
