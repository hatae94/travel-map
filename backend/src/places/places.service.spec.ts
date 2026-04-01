import { PlacesService } from './places.service';
import { EmbeddingService } from './embedding.service';

// Mock pg Pool
const mockQuery = jest.fn();
jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    query: mockQuery,
    end: jest.fn(),
  })),
}));

/** Find the SQL call whose query text contains a substring */
function findCall(substr: string): [string, unknown[]] | undefined {
  return mockQuery.mock.calls.find(
    ([sql]: [string]) => sql.includes(substr),
  );
}

describe('PlacesService', () => {
  let service: PlacesService;
  let embeddingService: Partial<EmbeddingService>;

  beforeEach(() => {
    mockQuery.mockReset();
    embeddingService = {
      embed: jest.fn().mockResolvedValue(new Array(384).fill(0.1)),
    };
    service = new PlacesService(embeddingService as EmbeddingService);
    service.onModuleInit();
  });

  describe('search (hybrid)', () => {
    it('returns merged results from both vector and keyword search', async () => {
      // keyword runs first (vector awaits embed), then vector
      mockQuery
        .mockResolvedValueOnce({
          rows: [
            { osm_id: 2, name: '원조족발', score: 0.8 },
            { osm_id: 3, name: '장충동족발', score: 0.6 },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            { osm_id: 1, name: '족발명가', score: 0.92 },
            { osm_id: 2, name: '원조족발', score: 0.88 },
          ],
        });

      const results = await service.search('족발');

      expect(results).toHaveLength(3);
      expect(results[0].osm_id).toBe(2);
      expect(results[0]).toHaveProperty('rrf_score');
    });

    it('returns keyword results even when vector search fails', async () => {
      (embeddingService.embed as jest.Mock).mockRejectedValueOnce(
        new Error('Model not loaded'),
      );
      mockQuery.mockResolvedValueOnce({
        rows: [{ osm_id: 1, name: '족발명가', score: 0.7 }],
      });

      const results = await service.search('족발');

      expect(results).toHaveLength(1);
      expect(results[0].osm_id).toBe(1);
    });

    it('returns vector results even when keyword search returns empty', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{ osm_id: 1, name: 'Gwanghwamun', score: 0.91 }],
        });

      const results = await service.search('광화문');

      expect(results).toHaveLength(1);
      expect(results[0].osm_id).toBe(1);
    });

    it('excludes low-score vector results from merge', async () => {
      // keyword: one good result
      mockQuery.mockResolvedValueOnce({
        rows: [{ osm_id: 1, name: '족발명가', score: 0.9 }],
      });
      // vector: returns noise (low scores below threshold)
      mockQuery.mockResolvedValueOnce({
        rows: [
          { osm_id: 10, name: '쌈지신발', score: 0.83 },
          { osm_id: 11, name: '지오지아', score: 0.82 },
        ],
      });

      const results = await service.search('족발');

      // Only keyword result should survive — vector noise filtered out
      expect(results).toHaveLength(1);
      expect(results[0].osm_id).toBe(1);
    });
  });

  describe('location-based search (3-way RRF)', () => {
    const location = { lat: 37.5665, lng: 126.978 };

    it('passes spatial params to vector search when location provided', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await service.search('카페', location);

      const vectorCall = findCall('name_embedding');
      expect(vectorCall).toBeDefined();
      const [sql, params] = vectorCall!;
      expect(sql).toContain('ST_DWithin');
      expect(params).toHaveLength(3);
      expect(params[1]).toBe(126.978); // lng
      expect(params[2]).toBe(37.5665); // lat
    });

    it('passes spatial params to keyword search when location provided', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await service.search('카페', location);

      const keywordCall = findCall('word_similarity');
      expect(keywordCall).toBeDefined();
      const [sql, params] = keywordCall!;
      expect(sql).toContain('ST_DWithin');
      expect(params).toHaveLength(3);
      expect(params[1]).toBe(126.978);
      expect(params[2]).toBe(37.5665);
    });

    it('runs spatial proximity query as third ranked list when location provided', async () => {
      // keyword, vector, spatial — 3 queries total
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ osm_id: 1, name: '카페A', score: 0.8 }],
        })
        .mockResolvedValueOnce({
          rows: [{ osm_id: 2, name: '카페B', score: 0.91 }],
        })
        .mockResolvedValueOnce({
          rows: [{ osm_id: 3, name: '카페C', score: 100.0 }],
        });

      const results = await service.search('카페', location);

      // Should have called 3 queries (keyword + vector + spatial)
      expect(mockQuery).toHaveBeenCalledTimes(3);
      const spatialCall = findCall('ST_Distance');
      expect(spatialCall).toBeDefined();
    });

    it('does NOT run spatial query when location is absent', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await service.search('카페');

      expect(mockQuery).toHaveBeenCalledTimes(2); // only keyword + vector
      const spatialCall = findCall('ST_Distance');
      expect(spatialCall).toBeUndefined();
    });
  });

  describe('keyword search SQL (trigram)', () => {
    it('uses word_similarity for scoring and ordering', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await service.search('광화문');

      const keywordCall = findCall('word_similarity');
      expect(keywordCall).toBeDefined();
      const [sql, params] = keywordCall!;

      expect(sql).toContain('word_similarity');
      expect(sql).not.toContain('ILIKE');
      expect(params).toHaveLength(1);
      expect(params[0]).toBe('광화문');
    });
  });

  describe('vector search SQL', () => {
    it('uses top-k retrieval without threshold in SQL', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await service.search('test');

      const vectorCall = findCall('name_embedding');
      expect(vectorCall).toBeDefined();
      const [, params] = vectorCall!;

      // SQL fetches top-k, filtering happens in application layer
      expect(params).toHaveLength(1);
    });
  });
});
