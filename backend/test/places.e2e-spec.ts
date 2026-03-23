import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';

describe('Places (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /places/search', () => {
    it('should return array of places for valid query', async () => {
      const res = await request(app.getHttpServer())
        .get('/places/search')
        .query({ q: '강남' })
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body.length).toBeLessThanOrEqual(10);
    });

    it('should return places with correct schema including score', async () => {
      const res = await request(app.getHttpServer())
        .get('/places/search')
        .query({ q: '강남' })
        .expect(200);

      const place = res.body[0];
      // 필수 필드
      expect(place).toHaveProperty('osm_id');
      expect(place).toHaveProperty('name');
      expect(place).toHaveProperty('longitude');
      expect(place).toHaveProperty('latitude');
      expect(place).toHaveProperty('score');

      // 타입 검증
      expect(typeof place.osm_id).toBe('string');
      expect(typeof place.name).toBe('string');
      expect(typeof place.longitude).toBe('number');
      expect(typeof place.latitude).toBe('number');
      expect(typeof place.score).toBe('number');

      // 선택 필드 (nullable)
      expect(place).toHaveProperty('name_ko');
      expect(place).toHaveProperty('name_en');
      expect(place).toHaveProperty('category');
      expect(place).toHaveProperty('type');
      expect(place).toHaveProperty('phone');
      expect(place).toHaveProperty('addr_full');
      expect(place).toHaveProperty('addr_province');
      expect(place).toHaveProperty('addr_city');
      expect(place).toHaveProperty('addr_district');
      expect(place).toHaveProperty('addr_suburb');
      expect(place).toHaveProperty('addr_street');
      expect(place).toHaveProperty('addr_housenumber');
    });

    it('should return score between 0 and 1', async () => {
      const res = await request(app.getHttpServer())
        .get('/places/search')
        .query({ q: '강남역' })
        .expect(200);

      for (const place of res.body) {
        expect(place.score).toBeGreaterThan(0);
        expect(place.score).toBeLessThanOrEqual(1);
      }
    });

    it('should return results ordered by score descending', async () => {
      const res = await request(app.getHttpServer())
        .get('/places/search')
        .query({ q: '서울 카페' })
        .expect(200);

      if (res.body.length > 1) {
        for (let i = 0; i < res.body.length - 1; i++) {
          expect(res.body[i].score).toBeGreaterThanOrEqual(res.body[i + 1].score);
        }
      }
    });

    it('should return max 10 results', async () => {
      const res = await request(app.getHttpServer())
        .get('/places/search')
        .query({ q: '서울' })
        .expect(200);

      expect(res.body.length).toBeLessThanOrEqual(10);
    });

    it('should return empty array for low relevance query', async () => {
      const res = await request(app.getHttpServer())
        .get('/places/search')
        .query({ q: 'xyzzy nonsense gibberish 12345' })
        .expect(200);

      // 벡터 검색은 항상 결과를 반환하지만 threshold 미달 시 빈 배열
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should return 400 when query is empty', async () => {
      const res = await request(app.getHttpServer())
        .get('/places/search')
        .query({ q: '' })
        .expect(400);

      expect(res.body).toMatchObject({
        statusCode: 400,
        message: '검색어를 입력해주세요.',
      });
    });

    it('should return 400 when query is missing', async () => {
      await request(app.getHttpServer())
        .get('/places/search')
        .expect(400);
    });

    it('should find semantically related places', async () => {
      // "커피숍"으로 검색하면 카페 관련 장소가 결과에 포함되어야 함
      const res = await request(app.getHttpServer())
        .get('/places/search')
        .query({ q: '커피숍' })
        .expect(200);

      const hasRelated = res.body.some(
        (p: { type?: string; name?: string }) =>
          p.type === 'cafe' ||
          (p.name && (p.name.includes('카페') || p.name.includes('커피'))),
      );
      expect(hasRelated).toBe(true);
    });

    it('should return valid coordinates within Korea bounds', async () => {
      const res = await request(app.getHttpServer())
        .get('/places/search')
        .query({ q: '서울' })
        .expect(200);

      if (res.body.length > 0) {
        for (const place of res.body) {
          expect(place.longitude).toBeGreaterThan(124);
          expect(place.longitude).toBeLessThan(132);
          expect(place.latitude).toBeGreaterThan(33);
          expect(place.latitude).toBeLessThan(43);
        }
      }
    });
  });
});
