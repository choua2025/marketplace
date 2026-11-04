import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getActor } from "@/server/auth/session";
import { listCustomersForAdmin, listProvidersForAdmin } from "@/server/services/admin";
import { CustomerTable, ProviderTable } from "@/components/admin/admin-tables";

const PREVIEW = 10;

export default async function AdminSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const [actor, { q }, t] = await Promise.all([getActor(), searchParams, getTranslations("admin")]);
  const query = q?.trim() ?? "";

  if (!query) {
    return (
      <>
        <h1 className="text-2xl font-bold">{t("searchLabel")}</h1>
        <p className="text-muted-foreground">{t("searchPrompt")}</p>
      </>
    );
  }

  const [customers, providers] = await Promise.all([
    listCustomersForAdmin(actor, { q: query, pageSize: PREVIEW }),
    listProvidersForAdmin(actor, { q: query, pageSize: PREVIEW }),
  ]);
  const encoded = encodeURIComponent(query);

  return (
    <>
      <h1 className="text-2xl font-bold">{t("searchTitle", { q: query })}</h1>

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-semibold">
            {t("navCustomers")}{" "}
            <span className="font-normal text-muted-foreground">
              · {t("resultsCount", { count: customers.total })}
            </span>
          </h2>
          {customers.total > PREVIEW ? (
            <Link
              href={`/admin/customers?q=${encoded}`}
              className="text-sm text-primary hover:underline"
            >
              {t("viewAll")}
            </Link>
          ) : null}
        </div>
        <CustomerTable customers={customers.items} />
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-semibold">
            {t("navProviders")}{" "}
            <span className="font-normal text-muted-foreground">
              · {t("resultsCount", { count: providers.total })}
            </span>
          </h2>
          {providers.total > PREVIEW ? (
            <Link
              href={`/admin/providers?q=${encoded}`}
              className="text-sm text-primary hover:underline"
            >
              {t("viewAll")}
            </Link>
          ) : null}
        </div>
        <ProviderTable providers={providers.items} />
      </section>
    </>
  );
}
