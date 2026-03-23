import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';

describe('Auth (e2e)', () => {
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

  describe('POST /auth/mock-login', () => {
    it('should return access_token for valid mock email', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/mock-login')
        .send({ email: 'mock1@test.com' })
        .expect(201);

      expect(res.body).toHaveProperty('access_token');
      expect(typeof res.body.access_token).toBe('string');
      expect(res.body.access_token.split('.')).toHaveLength(3); // JWT format: header.payload.signature
    });

    it('should return valid JWT payload with user info', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/mock-login')
        .send({ email: 'mock1@test.com' })
        .expect(201);

      // JWT payload 디코드하여 검증
      const payload = JSON.parse(
        Buffer.from(res.body.access_token.split('.')[1], 'base64url').toString(),
      );

      expect(payload).toMatchObject({
        sub: expect.any(String),
        email: 'mock1@test.com',
        nickname: '테스트유저1',
      });
      expect(payload).toHaveProperty('iat');
      expect(payload).toHaveProperty('exp');
      expect(payload.exp).toBeGreaterThan(payload.iat);
    });

    it('should return 400 when email is empty', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/mock-login')
        .send({ email: '' })
        .expect(400);

      expect(res.body).toMatchObject({
        statusCode: 400,
        message: '이메일을 입력해주세요.',
      });
    });

    it('should return 400 when email is missing', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/mock-login')
        .send({})
        .expect(400);

      expect(res.body.statusCode).toBe(400);
    });

    it('should return 401 for unregistered email', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/mock-login')
        .send({ email: 'unknown@test.com' })
        .expect(401);

      expect(res.body).toMatchObject({
        statusCode: 401,
        message: '등록되지 않은 이메일입니다.',
      });
    });

    it('should return different tokens for different users', async () => {
      const res1 = await request(app.getHttpServer())
        .post('/auth/mock-login')
        .send({ email: 'mock1@test.com' })
        .expect(201);

      const res2 = await request(app.getHttpServer())
        .post('/auth/mock-login')
        .send({ email: 'mock2@test.com' })
        .expect(201);

      expect(res1.body.access_token).not.toBe(res2.body.access_token);
    });
  });
});
