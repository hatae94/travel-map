import { apiFetch } from "./client";
import type { Place } from "./types";

export async function searchPlaces(query: string): Promise<Place[]> {
  return apiFetch<Place[]>(
    `/places/search?q=${encodeURIComponent(query)}`,
  );
}
