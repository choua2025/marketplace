"use server";

import { searchProviders, type SearchResultDto } from "@/server/services/search";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export async function searchProvidersAction(input: unknown): Promise<Result<SearchResultDto[]>> {
  try {
    const data = await searchProviders(null, input);
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "UNKNOWN_ERROR" };
  }
}
