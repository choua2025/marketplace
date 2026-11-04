import { BadgeCheck, ExternalLink, Star } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { AdminCustomerListItemDto, AdminProviderListItemDto } from "@/server/services/admin";
import { Badge } from "@/components/ui/badge";

const TH =
  "px-4 py-2.5 text-left text-xs font-medium tracking-wide text-muted-foreground uppercase";
const TD = "px-4 py-3 align-middle";

function TableShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-background">
      <table className="w-full min-w-[640px] text-sm">{children}</table>
    </div>
  );
}

function Empty({ colSpan }: { colSpan: number }) {
  const t = useTranslations("admin");
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-10 text-center text-muted-foreground">
        {t("noResults")}
      </td>
    </tr>
  );
}

export function CustomerTable({ customers }: { customers: AdminCustomerListItemDto[] }) {
  const t = useTranslations("admin");
  const format = useFormatter();

  return (
    <TableShell>
      <thead className="border-b bg-muted/40">
        <tr>
          <th className={TH}>{t("colName")}</th>
          <th className={TH}>{t("colEmail")}</th>
          <th className={TH}>{t("colPhone")}</th>
          <th className={`${TH} text-right`}>{t("colBookings")}</th>
          <th className={TH}>{t("colJoined")}</th>
        </tr>
      </thead>
      <tbody className="divide-y">
        {customers.length === 0 ? <Empty colSpan={5} /> : null}
        {customers.map((c) => (
          <tr key={c.id} className="hover:bg-muted/30">
            <td className={`${TD} font-medium`}>{c.fullName}</td>
            <td className={`${TD} text-muted-foreground`}>{c.email}</td>
            <td className={`${TD} text-muted-foreground`}>{c.phone ?? "—"}</td>
            <td className={`${TD} text-right tabular-nums`}>{c.bookingCount}</td>
            <td className={`${TD} whitespace-nowrap text-muted-foreground`}>
              {format.dateTime(c.createdAt, { dateStyle: "medium" })}
            </td>
          </tr>
        ))}
      </tbody>
    </TableShell>
  );
}

export function ProviderTable({ providers }: { providers: AdminProviderListItemDto[] }) {
  const t = useTranslations("admin");

  return (
    <TableShell>
      <thead className="border-b bg-muted/40">
        <tr>
          <th className={TH}>{t("colProvider")}</th>
          <th className={TH}>{t("colArea")}</th>
          <th className={TH}>{t("colRating")}</th>
          <th className={`${TH} text-right`}>{t("colJobs")}</th>
          <th className={TH}>{t("colStatus")}</th>
          <th className={TH}>
            <span className="sr-only">{t("viewProfile")}</span>
          </th>
        </tr>
      </thead>
      <tbody className="divide-y">
        {providers.length === 0 ? <Empty colSpan={6} /> : null}
        {providers.map((p) => (
          <tr key={p.id} className="hover:bg-muted/30">
            <td className={TD}>
              <div className="flex items-center gap-1 font-medium">
                {p.displayName}
                {p.isVerified ? <BadgeCheck className="size-4 shrink-0 text-primary" /> : null}
              </div>
              <div className="text-xs text-muted-foreground">
                {p.ownerName} · {p.email}
              </div>
            </td>
            <td className={`${TD} text-muted-foreground`}>{p.areaLabel ?? "—"}</td>
            <td className={`${TD} whitespace-nowrap`}>
              <span className="inline-flex items-center gap-1">
                <Star className="size-3.5 fill-amber-500 text-amber-500" />
                {p.ratingAvg}
                <span className="text-muted-foreground">({p.ratingCount})</span>
              </span>
            </td>
            <td className={`${TD} text-right tabular-nums`}>{p.completedJobs}</td>
            <td className={TD}>
              <div className="flex flex-wrap gap-1">
                <Badge variant={p.isActive ? "default" : "secondary"}>
                  {p.isActive ? t("statusActive") : t("statusInactive")}
                </Badge>
                {p.verificationStatus === "pending" ? (
                  <Badge variant="outline">{t("verificationPending")}</Badge>
                ) : null}
                {p.verificationStatus === "rejected" ? (
                  <Badge variant="destructive">{t("verificationRejected")}</Badge>
                ) : null}
              </div>
            </td>
            <td className={`${TD} text-right`}>
              {/* Public profiles only exist for providers accepting jobs. */}
              {p.isActive ? (
                <Link
                  href={`/p/${p.id}`}
                  className="inline-flex items-center gap-1 whitespace-nowrap text-primary hover:underline"
                >
                  {t("viewProfile")}
                  <ExternalLink className="size-3.5" />
                </Link>
              ) : null}
            </td>
          </tr>
        ))}
      </tbody>
    </TableShell>
  );
}

/** Page-level search box. A plain GET form, so it submits to the current (locale-prefixed) URL. */
export function ListSearchForm({
  placeholder,
  defaultValue,
  hidden,
}: {
  placeholder: string;
  defaultValue?: string;
  hidden?: Record<string, string>;
}) {
  const t = useTranslations("admin");
  return (
    <form method="get" role="search" className="flex w-full max-w-sm gap-2">
      {Object.entries(hidden ?? {}).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <input
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder={placeholder}
        aria-label={t("searchLabel")}
        className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />
    </form>
  );
}
