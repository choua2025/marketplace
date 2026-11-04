import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getActor } from "@/server/auth/session";
import {
  listProvidersForAdmin,
  parsePage,
  PROVIDER_FILTERS,
  type ProviderFilter,
} from "@/server/services/admin";
import { listVerifications } from "@/server/services/verification";
import { getSignedImageUrl } from "@/server/services/upload";
import { cn } from "@/lib/utils";
import { ListSearchForm, ProviderTable } from "@/components/admin/admin-tables";
import { VerificationReviewCard } from "@/components/admin/verification-review-card";
import { AdminPagination } from "@/components/admin/admin-pagination";

export default async function AdminProvidersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string; page?: string }>;
}) {
  const [actor, params, t] = await Promise.all([
    getActor(),
    searchParams,
    getTranslations("admin"),
  ]);
  const q = params.q;
  const filter: ProviderFilter = PROVIDER_FILTERS.includes(params.filter as ProviderFilter)
    ? (params.filter as ProviderFilter)
    : "all";

  const [result, pendingVerifications] = await Promise.all([
    listProvidersForAdmin(actor, { q, filter, page: parsePage(params.page) }),
    listVerifications(actor, "pending"),
  ]);

  const pendingWithDocs = await Promise.all(
    pendingVerifications.map(async (v) => ({
      ...v,
      documents: await Promise.all(
        v.documentKeys.map(async (key) => ({ key, url: await getSignedImageUrl(key) })),
      ),
    })),
  );

  const filterLabel: Record<ProviderFilter, string> = {
    all: t("statusAll"),
    pending: t("verificationPending"),
    verified: t("statusVerified"),
    inactive: t("statusInactive"),
  };
  const hrefFor = (value: ProviderFilter) => {
    const query = new URLSearchParams();
    if (value !== "all") query.set("filter", value);
    if (q) query.set("q", q);
    const qs = query.toString();
    return qs ? `/admin/providers?${qs}` : "/admin/providers";
  };

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t("navProviders")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("resultsCount", { count: result.total })}
          </p>
        </div>
        <ListSearchForm
          placeholder={t("searchProvidersPlaceholder")}
          defaultValue={q}
          hidden={filter !== "all" ? { filter } : undefined}
        />
      </div>

      {pendingWithDocs.length > 0 && !q && result.page === 1 ? (
        <section className="flex flex-col gap-3">
          <h2 className="font-semibold">
            {t("pendingVerifications")} ({pendingWithDocs.length})
          </h2>
          <div className="grid gap-3 lg:grid-cols-2">
            {pendingWithDocs.map((v) => (
              <VerificationReviewCard
                key={v.providerId}
                providerId={v.providerId}
                displayName={v.displayName}
                note={v.note}
                documents={v.documents}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {PROVIDER_FILTERS.map((value) => (
            <Link
              key={value}
              href={hrefFor(value)}
              aria-current={filter === value ? "page" : undefined}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-sm transition-colors",
                filter === value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-background hover:bg-muted",
              )}
            >
              {filterLabel[value]}
            </Link>
          ))}
        </div>
        <ProviderTable providers={result.items} />
        <AdminPagination
          basePath="/admin/providers"
          params={{ q, filter: filter !== "all" ? filter : undefined }}
          page={result.page}
          totalPages={result.totalPages}
          total={result.total}
          pageSize={result.pageSize}
        />
      </section>
    </>
  );
}
