import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, Controller, Get, UseGuards, Req } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { JwtAuthGuard } from './../src/auth/jwt-auth.guard';

// Guard 검증용 임시 컨트롤러
@Controller('test-protected')
class TestProtectedController {
  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@Req() req: any) {
    return { user: req.user };
  }
}

describe('JwtAuthGuard (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [TestProtectedController],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return 401 without token', async () => {
    await request(app.getHttpServer())
      .get('/test-protected/me')
      .expect(401);
  });

  it('should return 401 with invalid token', async () => {
    await request(app.getHttpServer())
      .get('/test-protected/me')
      .set('Authorization', 'Bearer invalid.jwt.token')
      .expect(401);
  });

  it('should return user info with valid token', async () => {
    // 먼저 토큰 발급
    const loginRes = await request(app.getHttpServer())
      .post('/auth/mock-login')
      .send({ email: 'mock1@test.com' })
      .expect(201);

    const token = loginRes.body.access_token;

    // 토큰으로 보호된 엔드포인트 접근
    const res = await request(app.getHttpServer())
      .get('/test-protected/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.user).toMatchObject({
      id: expect.any(String),
      email: 'mock1@test.com',
      nickname: '테스트유저1',
    });
  });

  it('should return 401 with expired token format', async () => {
    // 만료된 형태의 토큰 (임의 조작)
    await request(app.getHttpServer())
      .get('/test-protected/me')
      .set('Authorization', 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4IiwiZXhwIjoxfQ.invalid')
      .expect(401);
  });
});
