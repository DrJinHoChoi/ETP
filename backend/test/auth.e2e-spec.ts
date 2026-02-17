import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { ThrottlerGuard } from '@nestjs/throttler';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;
  const testEmail = `e2e-auth-${Date.now()}@test.com`;
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
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user with strong password', () => {
      return request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: testEmail,
          password: strongPassword,
          name: 'E2E 테스트',
          role: 'SUPPLIER',
          organization: 'E2E기업',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.accessToken).toBeDefined();
          expect(res.body.user.email).toBe(testEmail);
          accessToken = res.body.accessToken;
        });
    });

    it('should reject duplicate email', () => {
      return request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: testEmail,
          password: strongPassword,
          name: 'E2E 중복',
          role: 'CONSUMER',
          organization: 'E2E기업',
        })
        .expect(409);
    });

    it('should reject invalid payload', () => {
      return request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: 'not-valid' })
        .expect(400);
    });

    it('should reject weak password (no uppercase)', () => {
      return request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: `weak-noupper-${Date.now()}@test.com`,
          password: 'weakpass1!',
          name: '약한비밀번호',
          role: 'CONSUMER',
          organization: 'E2E기업',
        })
        .expect(400);
    });

    it('should reject weak password (no special character)', () => {
      return request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: `weak-nospecial-${Date.now()}@test.com`,
          password: 'WeakPass1',
          name: '약한비밀번호',
          role: 'CONSUMER',
          organization: 'E2E기업',
        })
        .expect(400);
    });

    it('should reject password shorter than 8 characters', () => {
      return request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: `weak-short-${Date.now()}@test.com`,
          password: 'Ab1!',
          name: '짧은비밀번호',
          role: 'CONSUMER',
          organization: 'E2E기업',
        })
        .expect(400);
    });

    it('should reject weak password (no digit)', () => {
      return request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: `weak-nodigit-${Date.now()}@test.com`,
          password: 'WeakPass!!',
          name: '약한비밀번호',
          role: 'CONSUMER',
          organization: 'E2E기업',
        })
        .expect(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', () => {
      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: testEmail,
          password: strongPassword,
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.accessToken).toBeDefined();
          expect(res.body.user.email).toBe(testEmail);
        });
    });

    it('should reject invalid credentials', () => {
      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: testEmail,
          password: 'WrongP@ss1',
        })
        .expect(401);
    });

    it('should reject non-existent user', () => {
      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@test.com',
          password: strongPassword,
        })
        .expect(401);
    });

    it('should reject empty email', () => {
      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: '',
          password: strongPassword,
        })
        .expect(400);
    });

    it('should reject empty password', () => {
      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: testEmail,
          password: '',
        })
        .expect(400);
    });
  });

  describe('GET /api/auth/profile', () => {
    it('should return profile with valid token', () => {
      return request(app.getHttpServer())
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.email).toBe(testEmail);
          expect(res.body).not.toHaveProperty('password');
        });
    });

    it('should reject without token', () => {
      return request(app.getHttpServer())
        .get('/api/auth/profile')
        .expect(401);
    });

    it('should reject with invalid token', () => {
      return request(app.getHttpServer())
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });
});
