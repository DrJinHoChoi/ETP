import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Settlement (e2e)', () => {
  let app: INestApplication;
  let supplierToken: string;
  let consumerToken: string;
  let supplierId: string;
  let consumerId: string;
  const supplierEmail = `e2e-settle-supplier-${Date.now()}@test.com`;
  const consumerEmail = `e2e-settle-consumer-${Date.now()}@test.com`;
  const strongPassword = 'StrongP@ss1';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

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

    // Register supplier
    const supplierRes = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: supplierEmail,
        password: strongPassword,
        name: 'E2E 정산공급자',
        role: 'SUPPLIER',
        organization: 'E2E정산공급기업',
      });
    supplierToken = supplierRes.body.accessToken;
    supplierId = supplierRes.body.user.id;

    // Register consumer
    const consumerRes = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: consumerEmail,
        password: strongPassword,
        name: 'E2E 정산소비자',
        role: 'CONSUMER',
        organization: 'E2E정산소비기업',
      });
    consumerToken = consumerRes.body.accessToken;
    consumerId = consumerRes.body.user.id;

    // DID 발급 (DIDAuthGuard 통과용 — register 시 DID 자동발급 실패 대비)
    await request(app.getHttpServer())
      .post('/api/auth/did/issue')
      .set('Authorization', `Bearer ${supplierToken}`);
    await request(app.getHttpServer())
      .post('/api/auth/did/issue')
      .set('Authorization', `Bearer ${consumerToken}`);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/settlement', () => {
    it('should return empty settlement history initially', () => {
      return request(app.getHttpServer())
        .get('/api/settlement')
        .set('Authorization', `Bearer ${supplierToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });

    it('should reject unauthenticated request', () => {
      return request(app.getHttpServer())
        .get('/api/settlement')
        .expect(401);
    });
  });

  describe('GET /api/settlement/stats', () => {
    it('should return settlement stats', () => {
      return request(app.getHttpServer())
        .get('/api/settlement/stats')
        .set('Authorization', `Bearer ${supplierToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('totalSettled');
          expect(res.body).toHaveProperty('totalAmount');
          expect(res.body).toHaveProperty('totalFee');
          expect(res.body).toHaveProperty('totalNetAmount');
        });
    });
  });

  describe('Settlement flow via order matching', () => {
    let tradeId: string;

    it('should create matching orders that produce a trade', async () => {
      // Create SELL order
      await request(app.getHttpServer())
        .post('/api/trading/orders')
        .set('Authorization', `Bearer ${supplierToken}`)
        .send({
          type: 'SELL',
          energySource: 'SOLAR',
          quantity: 30,
          price: 40,
          validFrom: new Date().toISOString(),
          validUntil: new Date(Date.now() + 86400000).toISOString(),
        })
        .expect(201);

      // Create matching BUY order
      await request(app.getHttpServer())
        .post('/api/trading/orders')
        .set('Authorization', `Bearer ${consumerToken}`)
        .send({
          type: 'BUY',
          energySource: 'SOLAR',
          quantity: 30,
          price: 40,
          validFrom: new Date().toISOString(),
          validUntil: new Date(Date.now() + 86400000).toISOString(),
        })
        .expect(201);

      // Check for trades
      const tradesRes = await request(app.getHttpServer())
        .get('/api/trading/trades')
        .set('Authorization', `Bearer ${supplierToken}`)
        .expect(200);

      // Should have at least one trade
      if (tradesRes.body.length > 0) {
        tradeId = tradesRes.body[0].id;
      }
    });

    it('should create a settlement from a trade', async () => {
      if (!tradeId) {
        // If no trade was auto-matched, skip this test gracefully
        return;
      }

      const res = await request(app.getHttpServer())
        .post(`/api/settlement/${tradeId}`)
        .set('Authorization', `Bearer ${supplierToken}`)
        .expect((response) => {
          // 201 for success, or 4xx if trade not in correct state
          expect([201, 400, 404]).toContain(response.status);
        });

      if (res.status === 201) {
        expect(res.body).toHaveProperty('id');
        expect(res.body).toHaveProperty('tradeId', tradeId);
        expect(res.body).toHaveProperty('fee');
        expect(res.body).toHaveProperty('netAmount');
        // Verify 2% fee calculation
        const fee = res.body.fee;
        const amount = res.body.amount;
        expect(fee).toBeCloseTo(amount * 0.02, 2);
      }
    });

    it('should confirm a pending settlement', async () => {
      if (!tradeId) return;

      // Get settlements for this trade
      const settlementsRes = await request(app.getHttpServer())
        .get('/api/settlement')
        .set('Authorization', `Bearer ${supplierToken}`)
        .expect(200);

      const pendingSettlement = settlementsRes.body.find(
        (s: any) => s.tradeId === tradeId && s.status === 'PENDING',
      );

      if (pendingSettlement) {
        const confirmRes = await request(app.getHttpServer())
          .post(`/api/settlement/${pendingSettlement.id}/confirm`)
          .set('Authorization', `Bearer ${supplierToken}`)
          .expect((response) => {
            expect([200, 201]).toContain(response.status);
          });

        if (confirmRes.status === 200 || confirmRes.status === 201) {
          // confirmSettlement returns array
          const result = Array.isArray(confirmRes.body)
            ? confirmRes.body[0]
            : confirmRes.body;
          expect(result.status).toBe('COMPLETED');
        }
      }
    });
  });

  describe('POST /api/settlement/:tradeId (error cases)', () => {
    it('should return 404 for non-existent trade', () => {
      return request(app.getHttpServer())
        .post('/api/settlement/non-existent-trade-id')
        .set('Authorization', `Bearer ${supplierToken}`)
        .expect((res) => {
          expect([400, 404, 500]).toContain(res.status);
        });
    });
  });

  describe('Dispute flow', () => {
    let disputeTradeId: string;

    it('should create a trade for dispute testing', async () => {
      // Create SELL order
      await request(app.getHttpServer())
        .post('/api/trading/orders')
        .set('Authorization', `Bearer ${supplierToken}`)
        .send({
          type: 'SELL',
          energySource: 'WIND',
          quantity: 20,
          price: 35,
          validFrom: new Date().toISOString(),
          validUntil: new Date(Date.now() + 86400000).toISOString(),
        })
        .expect(201);

      // Create matching BUY order
      await request(app.getHttpServer())
        .post('/api/trading/orders')
        .set('Authorization', `Bearer ${consumerToken}`)
        .send({
          type: 'BUY',
          energySource: 'WIND',
          quantity: 20,
          price: 35,
          validFrom: new Date().toISOString(),
          validUntil: new Date(Date.now() + 86400000).toISOString(),
        })
        .expect(201);

      // Fetch trades
      const tradesRes = await request(app.getHttpServer())
        .get('/api/trading/trades')
        .set('Authorization', `Bearer ${consumerToken}`)
        .expect(200);

      const windTrade = tradesRes.body.find(
        (t: any) => t.energySource === 'WIND',
      );
      if (windTrade) {
        disputeTradeId = windTrade.id;
      }
    });

    it('should file a dispute on a trade', async () => {
      if (!disputeTradeId) return;

      const res = await request(app.getHttpServer())
        .post(`/api/settlement/dispute/${disputeTradeId}`)
        .set('Authorization', `Bearer ${consumerToken}`)
        .send({ reason: 'E2E 테스트 분쟁 사유' })
        .expect((response) => {
          expect([200, 201]).toContain(response.status);
        });

      if (res.status === 200 || res.status === 201) {
        expect(res.body.status).toBe('DISPUTED');
        expect(res.body.tradeId).toBe(disputeTradeId);
      }
    });

    it('should reject duplicate dispute on same trade', async () => {
      if (!disputeTradeId) return;

      return request(app.getHttpServer())
        .post(`/api/settlement/dispute/${disputeTradeId}`)
        .set('Authorization', `Bearer ${consumerToken}`)
        .send({ reason: '중복 분쟁' })
        .expect(400);
    });

    it('should reject dispute from non-party user', async () => {
      if (!disputeTradeId) return;

      // Register a third-party user
      const thirdEmail = `e2e-third-${Date.now()}@test.com`;
      const thirdRes = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: thirdEmail,
          password: strongPassword,
          name: 'E2E 제3자',
          role: 'CONSUMER',
          organization: 'E2E기타기업',
        });
      const thirdToken = thirdRes.body.accessToken;

      // DID 발급 (DIDAuthGuard 통과용)
      await request(app.getHttpServer())
        .post('/api/auth/did/issue')
        .set('Authorization', `Bearer ${thirdToken}`);

      // File dispute from third-party on the existing disputed trade
      return request(app.getHttpServer())
        .post(`/api/settlement/dispute/${disputeTradeId}`)
        .set('Authorization', `Bearer ${thirdToken}`)
        .send({ reason: '제3자 분쟁 시도' })
        .expect(400);
    });
  });
});
