"use server";

import { getActor } from "@/server/auth/session";
import { searchProviders, type SearchResultDto } from "@/server/services/search";
import { getSignedImageUrl } from "@/server/services/upload";
import { listFavoritedProviderIds } from "@/server/services/favorite";
import { clientIp, enforceRateLimit } from "@/server/lib/rate-limit";
import { toActionResult } from "@/server/actions/result";

export type SearchResultWithAvatarDto = SearchResultDto & {
  avatarUrl: string | null;
  isFavorited: boolean;
};

type Result<T> =
  { ok: true; data: T; canFavorite: boolean } | { ok: false; error: string; canFavorite: boolean };

export async function searchProvidersAction(
  input: unknown,
): Promise<Result<SearchResultWithAvatarDto[]>> {
  const actor = await getActor();
  // Only a signed-in customer can favorite a provider -- the card hides
  // the heart button entirely rather than showing one that always fails.
  const canFavorite = actor?.role === "customer";

  const result = await toActionResult(async () => {
    // Per IP: anyone can search, signed in or not.
    await enforceRateLimit("search", await clientIp());
    const results = await searchProviders(null, input);
    const favorited = await listFavoritedProviderIds(
      actor,
      results.map((r) => r.id),
    );
    return Promise.all(
      results.map(async (r) => ({
        ...r,
        avatarUrl: await getSignedImageUrl(r.avatarKey),
        isFavorited: favorited.has(r.id),
      })),
    );
  });
  return { ...result, canFavorite };
}
