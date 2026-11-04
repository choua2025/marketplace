import { getTranslations } from "next-intl/server";
import { getActor } from "@/server/auth/session";
import { listCustomersForAdmin, parsePage } from "@/server/services/admin";
import { CustomerTable, ListSearchForm } from "@/components/admin/admin-tables";
import { AdminPagination } from "@/components/admin/admin-pagination";

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const [actor, params, t] = await Promise.all([
    getActor(),
    searchParams,
    getTranslations("admin"),
  ]);
  const { q } = params;
  const result = await listCustomersForAdmin(actor, { q, page: parsePage(params.page) });

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t("navCustomers")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("resultsCount", { count: result.total })}
          </p>
        </div>
        {/* A new search starts again from page 1 (the form doesn't carry ?page). */}
        <ListSearchForm placeholder={t("searchCustomersPlaceholder")} defaultValue={q} />
      </div>
      <CustomerTable customers={result.items} />
      <AdminPagination
        basePath="/admin/customers"
        params={{ q }}
        page={result.page}
        totalPages={result.totalPages}
        total={result.total}
        pageSize={result.pageSize}
      />
    </>
  );
}
