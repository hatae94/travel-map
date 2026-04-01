import { mergeWithRRF, mergeMultipleWithRRF, PlaceRow } from './rrf';

describe('mergeMultipleWithRRF', () => {
  it('merges 3 ranked lists with RRF scoring', () => {
    const vector: PlaceRow[] = [
      { osm_id: 1, name: 'A', score: 0.95 },
      { osm_id: 2, name: 'B', score: 0.90 },
    ];
    const keyword: PlaceRow[] = [
      { osm_id: 2, name: 'B', score: 1.0 },
      { osm_id: 3, name: 'C', score: 0.8 },
    ];
    const spatial: PlaceRow[] = [
      { osm_id: 3, name: 'C', score: 0.9 },
      { osm_id: 1, name: 'A', score: 0.7 },
    ];

    const result = mergeMultipleWithRRF([vector, keyword, spatial], 10);

    // osm_id=2: vector rank2 + keyword rank1 = 1/(60+2) + 1/(60+1)
    // osm_id=1: vector rank1 + spatial rank2 = 1/(60+1) + 1/(60+2)
    // osm_id=3: keyword rank2 + spatial rank1 = 1/(60+2) + 1/(60+1)
    // All three appear in exactly 2 lists → same total RRF
    // But osm_id=2 and osm_id=3 and osm_id=1 all get same score
    expect(result).toHaveLength(3);
    const ids = result.map((r) => r.osm_id);
    expect(ids).toContain(1);
    expect(ids).toContain(2);
    expect(ids).toContain(3);
    result.forEach((r) => expect(r.rrf_score).toBeGreaterThan(0));
  });

  it('item in all 3 lists ranks highest', () => {
    const list1: PlaceRow[] = [
      { osm_id: 1, name: 'A', score: 0.95 },
      { osm_id: 2, name: 'B', score: 0.90 },
    ];
    const list2: PlaceRow[] = [
      { osm_id: 1, name: 'A', score: 1.0 },
      { osm_id: 3, name: 'C', score: 0.8 },
    ];
    const list3: PlaceRow[] = [
      { osm_id: 1, name: 'A', score: 0.9 },
      { osm_id: 4, name: 'D', score: 0.7 },
    ];

    const result = mergeMultipleWithRRF([list1, list2, list3], 10);

    // osm_id=1 appears in all 3 lists at rank 1 → highest RRF
    expect(result[0].osm_id).toBe(1);
    expect(result[0].rrf_score).toBeGreaterThan(result[1].rrf_score);
  });

  it('handles single list (degenerates to passthrough)', () => {
    const list: PlaceRow[] = [
      { osm_id: 1, name: 'A', score: 0.9 },
    ];
    const result = mergeMultipleWithRRF([list], 10);
    expect(result).toHaveLength(1);
    expect(result[0].osm_id).toBe(1);
  });

  it('handles empty lists array', () => {
    const result = mergeMultipleWithRRF([], 10);
    expect(result).toEqual([]);
  });

  it('filters out empty lists from input', () => {
    const list1: PlaceRow[] = [
      { osm_id: 1, name: 'A', score: 0.95 },
    ];
    const result = mergeMultipleWithRRF([list1, [], []], 10);
    expect(result).toHaveLength(1);
    expect(result[0].osm_id).toBe(1);
  });

  it('respects limit parameter', () => {
    const list1: PlaceRow[] = Array.from({ length: 20 }, (_, i) => ({
      osm_id: i + 1,
      name: `Place ${i + 1}`,
      score: 0.9 - i * 0.01,
    }));
    const result = mergeMultipleWithRRF([list1], 5);
    expect(result).toHaveLength(5);
  });
});

describe('mergeWithRRF', () => {
  it('returns empty array when both inputs are empty', () => {
    const result = mergeWithRRF([], [], 10);
    expect(result).toEqual([]);
  });

  it('returns vector-only results when keyword is empty', () => {
    const vector: PlaceRow[] = [
      { osm_id: 1, name: 'A', score: 0.95 },
      { osm_id: 2, name: 'B', score: 0.90 },
    ];
    const result = mergeWithRRF(vector, [], 10);
    expect(result).toHaveLength(2);
    expect(result[0].osm_id).toBe(1);
    expect(result[1].osm_id).toBe(2);
  });

  it('returns keyword-only results when vector is empty', () => {
    const keyword: PlaceRow[] = [
      { osm_id: 3, name: 'C', score: 1.0 },
    ];
    const result = mergeWithRRF([], keyword, 10);
    expect(result).toHaveLength(1);
    expect(result[0].osm_id).toBe(3);
  });

  it('merges and deduplicates by osm_id', () => {
    const vector: PlaceRow[] = [
      { osm_id: 1, name: 'A', score: 0.95 },
      { osm_id: 2, name: 'B', score: 0.90 },
    ];
    const keyword: PlaceRow[] = [
      { osm_id: 2, name: 'B', score: 1.0 },
      { osm_id: 3, name: 'C', score: 1.0 },
    ];
    const result = mergeWithRRF(vector, keyword, 10);

    const ids = result.map((r) => r.osm_id);
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3); // no duplicates
  });

  it('ranks items appearing in both lists higher (RRF boost)', () => {
    // osm_id=2 appears in both lists → should get highest combined RRF score
    const vector: PlaceRow[] = [
      { osm_id: 1, name: 'A', score: 0.95 }, // rank 1 in vector
      { osm_id: 2, name: 'B', score: 0.90 }, // rank 2 in vector
    ];
    const keyword: PlaceRow[] = [
      { osm_id: 2, name: 'B', score: 1.0 },  // rank 1 in keyword
      { osm_id: 3, name: 'C', score: 1.0 },  // rank 2 in keyword
    ];
    const result = mergeWithRRF(vector, keyword, 10);

    // osm_id=2: RRF = 1/(60+2) + 1/(60+1) = ~0.0325
    // osm_id=1: RRF = 1/(60+1) = ~0.0164
    // osm_id=3: RRF = 1/(60+2) = ~0.0161
    expect(result[0].osm_id).toBe(2);
  });

  it('respects the limit parameter', () => {
    const vector: PlaceRow[] = Array.from({ length: 20 }, (_, i) => ({
      osm_id: i + 1,
      name: `Place ${i + 1}`,
      score: 0.9 - i * 0.01,
    }));
    const result = mergeWithRRF(vector, [], 5);
    expect(result).toHaveLength(5);
  });

  it('attaches rrf_score to each result', () => {
    const vector: PlaceRow[] = [
      { osm_id: 1, name: 'A', score: 0.95 },
    ];
    const result = mergeWithRRF(vector, [], 10);
    expect(result[0]).toHaveProperty('rrf_score');
    expect(typeof result[0].rrf_score).toBe('number');
    expect(result[0].rrf_score).toBeGreaterThan(0);
  });
});
