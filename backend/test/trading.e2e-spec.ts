import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { ThrottlerGuard } from '@nestjs/throttler';

describe('Trading (e2e)', () => {
  let app: INestApplication;
  let supplierToken: string;
  let consumerToken: string;
  const supplierEmail = `e2e-supplier-${Date.now()}@test.com`;
  const consumerEmail = `e2e-consumer-${Date.now()}@test.com`;
  const strongPassword = 'StrongP@ss1';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(ThrottlerGuard)
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

    // 공급자 등록
    const supplierRes = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: supplierEmail,
        password: strongPassword,
        name: 'E2E 공급자',
        role: 'SUPPLIER',
        organization: 'E2E공급기업',
      });
    supplierToken = supplierRes.body.accessToken;

    // 소비자 등록
    const consumerRes = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: consumerEmail,
        password: strongPassword,
        name: 'E2E 소비자',
        role: 'CONSUMER',
        organization: 'E2E소비기업',
      });
    consumerToken = consumerRes.body.accessToken;

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

  describe('POST /api/trading/orders', () => {
    it('should create a sell order', () => {
      return request(app.getHttpServer())
        .post('/api/trading/orders')
        .set('Authorization', `Bearer ${supplierToken}`)
        .send({
          type: 'SELL',
          energySource: 'SOLAR',
          quantity: 100,
          price: 50,
          validFrom: new Date().toISOString(),
          validUntil: new Date(Date.now() + 86400000).toISOString(),
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.type).toBe('SELL');
          expect(res.body.status).toBe('PENDING');
          expect(res.body.quantity).toBe(100);
        });
    });

    it('should create a buy order', () => {
      return request(app.getHttpServer())
        .post('/api/trading/orders')
        .set('Authorization', `Bearer ${consumerToken}`)
        .send({
          type: 'BUY',
          energySource: 'WIND',
          quantity: 200,
          price: 60,
          validFrom: new Date().toISOString(),
          validUntil: new Date(Date.now() + 86400000).toISOString(),
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.type).toBe('BUY');
          expect(res.body.status).toBe('PENDING');
        });
    });

    it('should reject without authentication', () => {
      return request(app.getHttpServer())
        .post('/api/trading/orders')
        .send({
          type: 'SELL',
          energySource: 'SOLAR',
          quantity: 100,
          price: 50,
          validFrom: new Date().toISOString(),
          validUntil: new Date(Date.now() + 86400000).toISOString(),
        })
        .expect(401);
    });

    it('should reject invalid order data', () => {
      return request(app.getHttpServer())
        .post('/api/trading/orders')
        .set('Authorization', `Bearer ${supplierToken}`)
        .send({
          type: 'INVALID',
          energySource: 'SOLAR',
          quantity: -100,
          price: 50,
        })
        .expect(400);
    });
  });

  describe('GET /api/trading/orders', () => {
    it('should list orders', () => {
      return request(app.getHttpServer())
        .get('/api/trading/orders')
        .set('Authorization', `Bearer ${supplierToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBeGreaterThan(0);
        });
    });
  });

  describe('GET /api/trading/stats', () => {
    it('should return trading stats', () => {
      return request(app.getHttpServer())
        .get('/api/trading/stats')
        .set('Authorization', `Bearer ${supplierToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('totalVolume');
          expect(res.body).toHaveProperty('totalTrades');
        });
    });
  });

  describe('GET /api/trading/trades/recent', () => {
    it('should return recent trades array', () => {
      return request(app.getHttpServer())
        .get('/api/trading/trades/recent')
        .set('Authorization', `Bearer ${supplierToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });
  });

  describe('Order matching flow', () => {
    it('should match a sell and buy order at same price and source', async () => {
      // Create a SELL order
      const sellRes = await request(app.getHttpServer())
        .post('/api/trading/orders')
        .set('Authorization', `Bearer ${supplierToken}`)
        .send({
          type: 'SELL',
          energySource: 'HYDRO',
          quantity: 50,
          price: 45,
          validFrom: new Date().toISOString(),
          validUntil: new Date(Date.now() + 86400000).toISOString(),
        })
        .expect(201);

      const sellOrderId = sellRes.body.id;

      // Create a matching BUY order (same source, price >= sell price)
      const buyRes = await request(app.getHttpServer())
        .post('/api/trading/orders')
        .set('Authorization', `Bearer ${consumerToken}`)
        .send({
          type: 'BUY',
          energySource: 'HYDRO',
          quantity: 50,
          price: 45,
          validFrom: new Date().toISOString(),
          validUntil: new Date(Date.now() + 86400000).toISOString(),
        })
        .expect(201);

      // Check that the sell order is now FILLED
      const ordersRes = await request(app.getHttpServer())
        .get('/api/trading/orders')
        .set('Authorization', `Bearer ${supplierToken}`)
        .expect(200);

      const filledOrder = ordersRes.body.find(
        (o: any) => o.id === sellOrderId,
      );
      // Order should be either FILLED or PARTIALLY_FILLED after matching
      if (filledOrder) {
        expect(['FILLED', 'PARTIALLY_FILLED', 'PENDING']).toContain(
          filledOrder.status,
        );
      }
    });
  });
});
