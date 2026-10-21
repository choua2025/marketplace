import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, Star } from "lucide-react";
import { getPublicProviderProfile } from "@/server/services/provider";
import { getSignedImageUrl } from "@/server/services/upload";
import { AppError } from "@/server/lib/errors";
import { env } from "@/server/lib/env";
import { Button } from "@/components/ui/button";
import { CategoryIcon } from "@/components/category-icon";
import { ProviderMapLoader } from "@/components/map/provider-map-loader";

const WEEKDAY_LABELS = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
const PRICE_UNIT_LABEL: Record<string, string> = {
  job: "ต่องาน",
  hour: "ต่อชั่วโมง",
  day: "ต่อวัน",
};

async function loadProfile(id: string) {
  try {
    return await getPublicProviderProfile(null, id);
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") return null;
    throw error;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const profile = await loadProfile(id);
  if (!profile) return {};

  const description = profile.bio?.slice(0, 160) ?? `${profile.displayName} บน ช่างดี`;
  return {
    title: `${profile.displayName} | ช่างดี`,
    description,
    openGraph: {
      title: profile.displayName,
      description,
      type: "profile",
    },
  };
}

export default async function ProviderProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await loadProfile(id);
  if (!profile) notFound();

  const [avatarUrl, portfolio] = await Promise.all([
    getSignedImageUrl(profile.avatarKey),
    Promise.all(
      profile.portfolio.map(async (item) => ({
        ...item,
        url: await getSignedImageUrl(item.imageKey),
      })),
    ),
  ]);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: profile.displayName,
    description: profile.bio ?? undefined,
    image: avatarUrl ?? undefined,
    aggregateRating:
      profile.ratingCount > 0
        ? {
            "@type": "AggregateRating",
            ratingValue: profile.ratingAvg,
            reviewCount: profile.ratingCount,
          }
        : undefined,
    geo:
      profile.latitude !== null && profile.longitude !== null
        ? { "@type": "GeoCoordinates", latitude: profile.latitude, longitude: profile.longitude }
        : undefined,
    url: `${env.APP_URL}/p/${profile.id}`,
  };

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-4 pb-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <section className="flex flex-col items-center gap-3 text-center">
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt={profile.displayName}
            width={96}
            height={96}
            className="size-24 rounded-full object-cover"
            unoptimized
          />
        ) : (
          <div className="bg-muted size-24 rounded-full" />
        )}
        <div className="flex items-center gap-1">
          <h1 className="text-2xl font-bold">{profile.displayName}</h1>
          {profile.isVerified ? <BadgeCheck className="text-primary size-5" /> : null}
        </div>
        <div className="text-muted-foreground flex items-center gap-1 text-sm">
          <Star className="size-4 fill-current" />
          {profile.ratingAvg} ({profile.ratingCount} รีวิว)
          {profile.areaLabel ? <span> · {profile.areaLabel}</span> : null}
        </div>
        <p className="text-lg font-semibold">
          {Number(profile.basePrice).toLocaleString()} บาท / {PRICE_UNIT_LABEL[profile.priceUnit]}
        </p>
        <Button asChild className="h-12 w-full max-w-xs">
          <Link href={`/book/${profile.id}`}>จองงานกับช่างนี้</Link>
        </Button>
      </section>

      {profile.categories.length > 0 ? (
        <section className="flex flex-wrap justify-center gap-2">
          {profile.categories.map((category) => (
            <span
              key={category.slug}
              className="bg-muted flex items-center gap-1 rounded-full px-3 py-1 text-sm"
            >
              <CategoryIcon icon={category.icon} className="size-4" />
              {category.nameTh}
            </span>
          ))}
        </section>
      ) : null}

      {profile.bio ? (
        <section>
          <h2 className="mb-1 font-semibold">เกี่ยวกับช่างนี้</h2>
          <p className="text-muted-foreground text-sm whitespace-pre-line">{profile.bio}</p>
        </section>
      ) : null}

      {portfolio.length > 0 ? (
        <section>
          <h2 className="mb-2 font-semibold">ผลงาน</h2>
          <div className="grid grid-cols-3 gap-2">
            {portfolio.map((item) =>
              item.url ? (
                <div key={item.id} className="relative aspect-square">
                  <Image
                    src={item.url}
                    alt={item.caption ?? "ผลงาน"}
                    fill
                    className="rounded-md object-cover"
                    unoptimized
                  />
                </div>
              ) : null,
            )}
          </div>
        </section>
      ) : null}

      {profile.availability.length > 0 ? (
        <section>
          <h2 className="mb-2 font-semibold">เวลาทำงาน</h2>
          <ul className="text-muted-foreground text-sm">
            {profile.availability.map((a) => (
              <li key={a.weekday}>
                {WEEKDAY_LABELS[a.weekday]}: {a.startTime.slice(0, 5)} - {a.endTime.slice(0, 5)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {profile.latitude !== null && profile.longitude !== null ? (
        <section>
          <h2 className="mb-2 font-semibold">พื้นที่ให้บริการ</h2>
          <ProviderMapLoader
            center={{ lat: profile.latitude, lng: profile.longitude }}
            markers={[
              {
                id: profile.id,
                lat: profile.latitude,
                lng: profile.longitude,
                label: profile.displayName,
              },
            ]}
            zoom={13}
          />
        </section>
      ) : null}
    </main>
  );
}
