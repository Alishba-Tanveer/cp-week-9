import {
  Controller,
  Get,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';

import { AppModule } from '../src/app.module';
import { configureSecurity } from '../src/config/security';
import { User } from '../src/entities/User';
import { Public } from '../src/auth/decorators/public.decorator';

@Controller('test/security')
class SecurityTestController {
  @Get('unexpected-error')
  @Public()
  triggerUnexpectedError(): never {
    throw new Error('database password should never be exposed');
  }
}

describe('Assignment 3 Security API (e2e)', () => {
  let app: INestApplication;
  let userRepository: Repository<User>;

  const email = `security-${Date.now()}@example.com`;
  const password = 'StrongPassword123!';
  const name = 'Security Test User';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [SecurityTestController],
    }).compile();

    app = moduleRef.createNestApplication();

    configureSecurity(app, moduleRef.get(ConfigService));

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();

    userRepository = moduleRef.get<Repository<User>>(
      getRepositoryToken(User),
    );

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name,
        email,
        password,
      })
      .expect(201);
  });

  afterAll(async () => {
    await userRepository.delete({
      email,
    });

    await app.close();
  });

  it('returns 429 after repeated rapid login attempts', async () => {
    const responses = [];

    for (let attempt = 0; attempt < 21; attempt += 1) {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email,
          password: 'WrongPassword123!',
        });

      responses.push(response.status);
    }

    expect(responses.slice(0, 20)).toEqual(Array(20).fill(401));
    expect(responses[20]).toBe(429);
  }, 30000);

  it('returns the required error shape for a bad route parameter', async () => {
    const response = await request(app.getHttpServer()).get(
      '/tasks/abc',
    );

    expect(response.status).toBe(400);

    expect(Object.keys(response.body).sort()).toEqual([
      'error',
      'message',
      'path',
      'statusCode',
      'timestamp',
    ]);

    expect(response.body).toMatchObject({
      statusCode: 400,
      error: 'Bad Request',
      path: '/tasks/abc',
    });

    expect(typeof response.body.message).toBe('string');
    expect(typeof response.body.timestamp).toBe('string');
  });

  it('rejects unexpected DTO properties', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Unexpected Field User',
        email: `unexpected-${Date.now()}@example.com`,
        password,
        role: 'admin',
        isAdmin: true,
      });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      statusCode: 400,
      error: 'Bad Request',
      path: '/auth/register',
    });
  });

  it('returns the required error shape for a missing route', async () => {
    const response = await request(app.getHttpServer()).get(
      '/this-route-does-not-exist',
    );

    expect(response.status).toBe(404);

    expect(Object.keys(response.body).sort()).toEqual([
      'error',
      'message',
      'path',
      'statusCode',
      'timestamp',
    ]);

    expect(response.body).toMatchObject({
      statusCode: 404,
      error: 'Not Found',
      message: expect.any(String),
      path: '/this-route-does-not-exist',
    });

    expect(typeof response.body.timestamp).toBe('string');
  });

  it('returns a generic error for unexpected server failures', async () => {
    const response = await request(app.getHttpServer()).get(
      '/test/security/unexpected-error',
    );

    expect(response.status).toBe(500);

    expect(Object.keys(response.body).sort()).toEqual([
      'error',
      'message',
      'path',
      'statusCode',
      'timestamp',
    ]);

    expect(response.body).toMatchObject({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Internal server error',
      path: '/test/security/unexpected-error',
    });

    expect(JSON.stringify(response.body)).not.toContain('stack');
    expect(JSON.stringify(response.body)).not.toContain('password');
    expect(JSON.stringify(response.body)).not.toContain('database');
  });

  it('returns 400 for a non-positive route parameter', async () => {
    const response = await request(app.getHttpServer()).get(
      '/tasks/0',
    );

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      statusCode: 400,
      error: 'Bad Request',
      path: '/tasks/0',
    });
  });

  it('allows the configured CORS origin', async () => {
    const response = await request(app.getHttpServer())
      .options('/projects')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'GET');

    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe(
      'http://localhost:3000',
    );
  });

  it('blocks a disallowed CORS origin', async () => {
    const response = await request(app.getHttpServer())
      .get('/projects')
      .set('Origin', 'http://malicious.example');

    expect(response.headers['access-control-allow-origin']).not.toBe(
      'http://malicious.example',
    );
  });

  it('sets Helmet security headers', async () => {
    const response = await request(app.getHttpServer()).get('/projects');

    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(response.headers['strict-transport-security']).toBeDefined();
  });

  it('sets a restrictive Content-Security-Policy header', async () => {
    const response = await request(app.getHttpServer()).get('/projects');

    const contentSecurityPolicy =
      response.headers['content-security-policy'];

    expect(contentSecurityPolicy).toBeDefined();
    expect(contentSecurityPolicy).toContain("default-src 'self'");
    expect(contentSecurityPolicy).toContain("script-src 'self'");
    expect(contentSecurityPolicy).toContain("object-src 'none'");
    expect(contentSecurityPolicy).toContain("frame-ancestors 'self'");
  });
});
