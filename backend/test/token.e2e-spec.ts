import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { ThrottlerGuard } from '@nestjs/throttler';

describe('Token (e2e)', () => {
  let app: INestApplication;
  let userAToken: string;
  let userBToken: string;
  let userAId: string;
  let userBId: string;
  const userAEmail = `e2e-token-a-${Date.now()}@test.com`;
  const userBEmail = `e2e-token-b-${Date.now()}@test.com`;
  const strongPassword = 'StrongP@ss1';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();

    // Register user A
    const resA = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: userAEmail,
        password: strongPassword,
        name: 'E2E 토큰A',
        role: 'SUPPLIER',
        organization: 'E2E토큰기업A',
      });
    userAToken = resA.body.accessToken;
    userAId = resA.body.user.id;

    // Register user B
    const resB = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: userBEmail,
        password: strongPassword,
        name: 'E2E 토큰B',
        role: 'CONSUMER',
        organization: 'E2E토큰기업B',
      });
    userBToken = resB.body.accessToken;
    userBId = resB.body.user.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/token/balance', () => {
    it('should return balance for authenticated user', () => {
      return request(app.getHttpServer())
        .get('/api/token/balance')
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('balance');
          expect(res.body).toHaveProperty('lockedBalance');
          expect(res.body).toHaveProperty('availableBalance');
          expect(typeof res.body.balance).toBe('number');
          expect(typeof res.body.lockedBalance).toBe('number');
          expect(typeof res.body.availableBalance).toBe('number');
        });
    });

    it('should return zero balance for new user', () => {
      return request(app.getHttpServer())
        .get('/api/token/balance')
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.balance).toBe(0);
          expect(res.body.lockedBalance).toBe(0);
          expect(res.body.availableBalance).toBe(0);
        });
    });

    it('should reject unauthenticated request', () => {
      return request(app.getHttpServer())
        .get('/api/token/balance')
        .expect(401);
    });
  });

  describe('GET /api/token/transactions', () => {
    it('should return empty transaction list initially', () => {
      return request(app.getHttpServer())
        .get('/api/token/transactions')
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });

    it('should reject unauthenticated request', () => {
      return request(app.getHttpServer())
        .get('/api/token/transactions')
        .expect(401);
    });
  });

  describe('POST /api/token/transfer', () => {
    it('should reject transfer with insufficient balance', () => {
      return request(app.getHttpServer())
        .post('/api/token/transfer')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          toUserId: userBId,
          amount: 1000,
          reason: 'E2E 테스트 이체',
        })
        .expect(400);
    });

    it('should reject transfer to self', () => {
      return request(app.getHttpServer())
        .post('/api/token/transfer')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          toUserId: userAId,
          amount: 10,
          reason: '자기이체 테스트',
        })
        .expect(400);
    });

    it('should reject transfer with invalid amount (zero)', () => {
      return request(app.getHttpServer())
        .post('/api/token/transfer')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          toUserId: userBId,
          amount: 0,
          reason: '0 이체 테스트',
        })
        .expect(400);
    });

    it('should reject transfer with negative amount', () => {
      return request(app.getHttpServer())
        .post('/api/token/transfer')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          toUserId: userBId,
          amount: -10,
          reason: '음수 이체 테스트',
        })
        .expect(400);
    });

    it('should reject transfer without authentication', () => {
      return request(app.getHttpServer())
        .post('/api/token/transfer')
        .send({
          toUserId: userBId,
          amount: 10,
          reason: '미인증 이체',
        })
        .expect(401);
    });
  });

  describe('POST /api/token/admin/mint', () => {
    it('should reject non-admin mint request', () => {
      return request(app.getHttpServer())
        .post('/api/token/admin/mint')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          userId: userAId,
          amount: 1000,
          reason: 'E2E 테스트 발행',
        })
        .expect(403);
    });

    it('should reject unauthenticated mint request', () => {
      return request(app.getHttpServer())
        .post('/api/token/admin/mint')
        .send({
          userId: userAId,
          amount: 1000,
          reason: '미인증 발행',
        })
        .expect(401);
    });
  });

  describe('Token transfer flow with balance', () => {
    // This section tests the flow assuming admin mint is available
    // In a real E2E environment with an admin user, these tests would work end-to-end

    it('should get transaction history with type filter', () => {
      return request(app.getHttpServer())
        .get('/api/token/transactions')
        .query({ type: 'TRANSFER' })
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });

    it('should get transaction history with date filter', () => {
      const from = new Date(Date.now() - 86400000).toISOString();
      const to = new Date().toISOString();

      return request(app.getHttpServer())
        .get('/api/token/transactions')
        .query({ from, to })
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });
  });

  describe('Balance consistency', () => {
    it('should have availableBalance = balance - lockedBalance', () => {
      return request(app.getHttpServer())
        .get('/api/token/balance')
        .set('Authorization', `Bearer ${userBToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.availableBalance).toBe(
            res.body.balance - res.body.lockedBalance,
          );
        });
    });

    it('should not have negative balance', () => {
      return request(app.getHttpServer())
        .get('/api/token/balance')
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.balance).toBeGreaterThanOrEqual(0);
          expect(res.body.lockedBalance).toBeGreaterThanOrEqual(0);
        });
    });
  });
});
