"use server";

import { getActor } from "@/server/auth/session";
import { searchProviders, type SearchResultDto } from "@/server/services/search";
import { getSignedImageUrl } from "@/server/services/upload";
import { listFavoritedProviderIds } from "@/server/services/favorite";

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

  try {
    const results = await searchProviders(null, input);
    const favorited = await listFavoritedProviderIds(
      actor,
      results.map((r) => r.id),
    );
    const data = await Promise.all(
      results.map(async (result) => ({
        ...result,
        avatarUrl: await getSignedImageUrl(result.avatarKey),
        isFavorited: favorited.has(result.id),
      })),
    );
    return { ok: true, data, canFavorite };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "UNKNOWN_ERROR",
      canFavorite,
    };
  }
}
