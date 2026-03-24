import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';

describe('TravelPlans (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let planId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // mock user 토큰 발급
    const loginRes = await request(app.getHttpServer())
      .post('/auth/mock-login')
      .send({ email: 'mock1@test.com' });
    token = loginRes.body.access_token;
  });

  afterAll(async () => {
    await app.close();
  });

  // === 여행 계획 CRUD ===

  describe('POST /travel-plans', () => {
    it('should create a travel plan', async () => {
      const res = await request(app.getHttpServer())
        .post('/travel-plans')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: '제주도 여행',
          description: '3박 4일 제주 여행',
          start_date: '2026-04-01',
          end_date: '2026-04-04',
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.title).toBe('제주도 여행');
      expect(res.body.description).toBe('3박 4일 제주 여행');
      expect(res.body.start_date).toBe('2026-04-01');
      expect(res.body.end_date).toBe('2026-04-04');
      planId = res.body.id;
    });

    it('should return 401 without token', async () => {
      await request(app.getHttpServer())
        .post('/travel-plans')
        .send({ title: '테스트' })
        .expect(401);
    });

    it('should return 400 without title', async () => {
      await request(app.getHttpServer())
        .post('/travel-plans')
        .set('Authorization', `Bearer ${token}`)
        .send({ description: '제목 없음' })
        .expect(400);
    });
  });

  describe('GET /travel-plans', () => {
    it('should list user travel plans', async () => {
      const res = await request(app.getHttpServer())
        .get('/travel-plans')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0]).toHaveProperty('id');
      expect(res.body[0]).toHaveProperty('title');
    });

    it('should return 401 without token', async () => {
      await request(app.getHttpServer())
        .get('/travel-plans')
        .expect(401);
    });
  });

  describe('GET /travel-plans/:id', () => {
    it('should return plan detail with items', async () => {
      const res = await request(app.getHttpServer())
        .get(`/travel-plans/${planId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.id).toBe(planId);
      expect(res.body.title).toBe('제주도 여행');
      expect(res.body).toHaveProperty('items');
      expect(Array.isArray(res.body.items)).toBe(true);
    });

    it('should return 404 for non-existent plan', async () => {
      await request(app.getHttpServer())
        .get('/travel-plans/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });

  describe('PATCH /travel-plans/:id', () => {
    it('should update plan title and dates', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/travel-plans/${planId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: '제주도 여행 수정', end_date: '2026-04-05' })
        .expect(200);

      expect(res.body.title).toBe('제주도 여행 수정');
      expect(res.body.end_date).toBe('2026-04-05');
    });
  });

  // === 여행 계획 아이템 (장소) ===

  describe('POST /travel-plans/:id/items', () => {
    it('should add a place to the plan', async () => {
      const res = await request(app.getHttpServer())
        .post(`/travel-plans/${planId}/items`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          place_node_id: 1,
          memo: '꼭 가봐야 할 곳',
          visit_order: 1,
          visit_date: '2026-04-01',
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.place_node_id).toBe(1);
      expect(res.body.memo).toBe('꼭 가봐야 할 곳');
      expect(res.body.visit_order).toBe(1);
    });

    it('should list items in plan detail', async () => {
      const res = await request(app.getHttpServer())
        .get(`/travel-plans/${planId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.items.length).toBe(1);
      expect(res.body.items[0].memo).toBe('꼭 가봐야 할 곳');
    });
  });

  describe('DELETE /travel-plans/:id/items/:itemId', () => {
    it('should remove item from plan', async () => {
      // 먼저 아이템 ID 조회
      const detail = await request(app.getHttpServer())
        .get(`/travel-plans/${planId}`)
        .set('Authorization', `Bearer ${token}`);
      const itemId = detail.body.items[0].id;

      await request(app.getHttpServer())
        .delete(`/travel-plans/${planId}/items/${itemId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // 삭제 후 확인
      const after = await request(app.getHttpServer())
        .get(`/travel-plans/${planId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(after.body.items.length).toBe(0);
    });
  });

  describe('DELETE /travel-plans/:id', () => {
    it('should delete the plan', async () => {
      await request(app.getHttpServer())
        .delete(`/travel-plans/${planId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // 삭제 확인
      await request(app.getHttpServer())
        .get(`/travel-plans/${planId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });
});
