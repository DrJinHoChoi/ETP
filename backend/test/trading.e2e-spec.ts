import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Trading (e2e)', () => {
  let app: INestApplication;
  let supplierToken: string;
  let consumerToken: string;
  const supplierEmail = `e2e-supplier-${Date.now()}@test.com`;
  const consumerEmail = `e2e-consumer-${Date.now()}@test.com`;

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

    // 공급자 등록
    const supplierRes = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: supplierEmail,
        password: 'testpass123',
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
        password: 'testpass123',
        name: 'E2E 소비자',
        role: 'CONSUMER',
        organization: 'E2E소비기업',
      });
    consumerToken = consumerRes.body.accessToken;
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
  });

  describe('GET /api/trading/orders', () => {
    it('should list orders', () => {
      return request(app.getHttpServer())
        .get('/api/trading/orders')
        .set('Authorization', `Bearer ${supplierToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
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
});
