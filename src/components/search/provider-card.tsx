import Link from "next/link";
import { BadgeCheck, Star } from "lucide-react";
import type { SearchResultDto } from "@/server/services/search";

const PRICE_UNIT_LABEL: Record<string, string> = {
  job: "ต่องาน",
  hour: "ต่อชั่วโมง",
  day: "ต่อวัน",
};

export function ProviderCard({ provider }: { provider: SearchResultDto }) {
  return (
    <Link
      href={`/p/${provider.id}`}
      className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent"
    >
      <div className="bg-muted size-14 shrink-0 rounded-full" />
      <div className="flex flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-1">
          <span className="font-medium">{provider.displayName}</span>
          {provider.isVerified ? <BadgeCheck className="text-primary size-4" /> : null}
        </div>
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <span className="flex items-center gap-0.5">
            <Star className="size-3.5 fill-current" /> {provider.ratingAvg} ({provider.ratingCount})
          </span>
          <span>{provider.distanceKm.toFixed(1)} กม.</span>
        </div>
        {provider.areaLabel ? (
          <span className="text-muted-foreground text-xs">{provider.areaLabel}</span>
        ) : null}
      </div>
      <div className="text-right text-sm font-medium whitespace-nowrap">
        {Number(provider.basePrice).toLocaleString()} บาท
        <br />
        <span className="text-muted-foreground text-xs">
          {PRICE_UNIT_LABEL[provider.priceUnit]}
        </span>
      </div>
    </Link>
  );
}
