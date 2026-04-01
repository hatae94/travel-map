export interface PlaceRow {
  osm_id: number;
  name: string;
  score: number;
  [key: string]: unknown;
}

export interface RankedPlace extends PlaceRow {
  rrf_score: number;
}

const RRF_K = 60;

/** Reciprocal Rank Fusion — merges N ranked lists */
export function mergeMultipleWithRRF(
  rankedLists: PlaceRow[][],
  limit: number,
): RankedPlace[] {
  const scoreMap = new Map<number, { row: PlaceRow; rrf: number }>();

  for (const list of rankedLists) {
    for (let i = 0; i < list.length; i++) {
      const row = list[i];
      const rrf = 1 / (RRF_K + (i + 1));
      const existing = scoreMap.get(row.osm_id);
      if (existing) {
        existing.rrf += rrf;
      } else {
        scoreMap.set(row.osm_id, { row, rrf });
      }
    }
  }

  return Array.from(scoreMap.values())
    .sort((a, b) => b.rrf - a.rrf)
    .slice(0, limit)
    .map(({ row, rrf }) => ({ ...row, rrf_score: rrf }));
}

/** Reciprocal Rank Fusion — merges two ranked lists (legacy convenience wrapper) */
export function mergeWithRRF(
  vectorResults: PlaceRow[],
  keywordResults: PlaceRow[],
  limit: number,
): RankedPlace[] {
  return mergeMultipleWithRRF([vectorResults, keywordResults], limit);
}
