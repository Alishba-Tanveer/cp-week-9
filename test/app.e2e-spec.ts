import { createHash } from 'crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AppModule } from '../src/app.module';
import { RefreshToken } from '../src/entities/RefreshToken';
import { User } from '../src/entities/User';

describe('Auth API (e2e)', () => {
  let app: INestApplication;
  let userRepository: Repository<User>;
  let refreshTokenRepository: Repository<RefreshToken>;

  const email = `c5-${Date.now()}@example.com`;
  const password = 'C5TestPassword123!';
  const name = 'C5 E2E User';

  let firstRefreshToken: string;
  let rotatedRefreshToken: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();

    userRepository = app.get<Repository<User>>(
      getRepositoryToken(User),
    );

    refreshTokenRepository = app.get<Repository<RefreshToken>>(
      getRepositoryToken(RefreshToken),
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
    const user = await userRepository.findOne({
      where: { email },
    });

    if (user) {
      await refreshTokenRepository.delete({
        userId: user.id,
      });

      await userRepository.delete(user.id);
    }

    await app.close();
  });

  it('logs in successfully with valid credentials', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email,
        password,
      })
      .expect(200);

    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(response.body.refreshToken).toEqual(expect.any(String));

    firstRefreshToken = response.body.refreshToken;
  });

  it('rejects an incorrect password with 401', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email,
        password: 'WrongPassword123!',
      })
      .expect(401);

    expect(response.body.message).toBe('Invalid email or password');
  });

  it('rotates the refresh token', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({
        refreshToken: firstRefreshToken,
      })
      .expect(200);

    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(response.body.refreshToken).toEqual(expect.any(String));

    rotatedRefreshToken = response.body.refreshToken;

    expect(rotatedRefreshToken).not.toBe(firstRefreshToken);
  });

  it('revokes the entire refresh-token family when a revoked token is reused', async () => {
    const firstRefreshTokenHash = createHash('sha256')
      .update(firstRefreshToken)
      .digest('hex');

    const rotatedRefreshTokenHash = createHash('sha256')
      .update(rotatedRefreshToken)
      .digest('hex');

    const firstTokenRow = await refreshTokenRepository.findOne({
      where: {
        tokenHash: firstRefreshTokenHash,
      },
    });

    const rotatedTokenRow = await refreshTokenRepository.findOne({
      where: {
        tokenHash: rotatedRefreshTokenHash,
      },
    });

    expect(firstTokenRow).not.toBeNull();
    expect(rotatedTokenRow).not.toBeNull();

    if (!firstTokenRow || !rotatedTokenRow) {
      throw new Error('Expected refresh-token rows were not found');
    }

    expect(firstTokenRow.familyId).toBe(rotatedTokenRow.familyId);

    expect(firstTokenRow.revokedAt).not.toBeNull();
    expect(rotatedTokenRow.revokedAt).toBeNull();

    const familyId = firstTokenRow.familyId;

    const familyBeforeReuse = await refreshTokenRepository.find({
      where: {
        familyId,
      },
    });

    expect(familyBeforeReuse.length).toBeGreaterThanOrEqual(2);

    const activeTokensBeforeReuse = familyBeforeReuse.filter(
      (token) => token.revokedAt === null,
    );

    expect(activeTokensBeforeReuse.length).toBeGreaterThanOrEqual(1);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({
        refreshToken: firstRefreshToken,
      })
      .expect(401);

    const familyAfterReuse = await refreshTokenRepository.find({
      where: {
        familyId,
      },
    });

    expect(familyAfterReuse.length).toBeGreaterThanOrEqual(2);

    const revokedTokensAfterReuse = familyAfterReuse.filter(
      (token) => token.revokedAt !== null,
    );

    expect(revokedTokensAfterReuse.length).toBe(
      familyAfterReuse.length,
    );

    expect(
      familyAfterReuse.every(
        (token) => token.revokedAt !== null,
      ),
    ).toBe(true);
  });

  it('rejects an unknown email with the same 401 response', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: `unknown-${Date.now()}@example.com`,
        password,
      })
      .expect(401);

    expect(response.body.message).toBe('Invalid email or password');
  });

  it('logs out by revoking the presented refresh token', async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email,
        password,
      })
      .expect(200);

    const logoutRefreshToken = loginResponse.body.refreshToken;

    const refreshTokenHash = createHash('sha256')
      .update(logoutRefreshToken)
      .digest('hex');

    const beforeLogout = await refreshTokenRepository.findOne({
      where: {
        tokenHash: refreshTokenHash,
      },
    });

    expect(beforeLogout).not.toBeNull();

    if (!beforeLogout) {
      throw new Error('Expected refresh-token row was not found');
    }

    expect(beforeLogout.revokedAt).toBeNull();

    await request(app.getHttpServer())
      .post('/auth/logout')
      .send({
        refreshToken: logoutRefreshToken,
      })
      .expect(200);

    const afterLogout = await refreshTokenRepository.findOne({
      where: {
        tokenHash: refreshTokenHash,
      },
    });

    expect(afterLogout).not.toBeNull();

    if (!afterLogout) {
      throw new Error('Expected refresh-token row to remain after logout');
    }

    expect(afterLogout.revokedAt).not.toBeNull();

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({
        refreshToken: logoutRefreshToken,
      })
      .expect(401);
  });

  it('rejects an expired refresh token with 401', async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email,
        password,
      })
      .expect(200);

    const expiredRefreshToken = loginResponse.body.refreshToken;

    const refreshTokenHash = createHash('sha256')
      .update(expiredRefreshToken)
      .digest('hex');

    const tokenRow = await refreshTokenRepository.findOne({
      where: {
        tokenHash: refreshTokenHash,
      },
    });

    expect(tokenRow).not.toBeNull();

    if (!tokenRow) {
      throw new Error('Expected refresh-token row was not found');
    }

    await refreshTokenRepository.update(
      { id: tokenRow.id },
      {
        expiresAt: new Date(Date.now() - 60_000),
      },
    );

    const expiredRow = await refreshTokenRepository.findOne({
      where: {
        id: tokenRow.id,
      },
    });

    expect(expiredRow).not.toBeNull();

    if (!expiredRow) {
      throw new Error('Expected expired refresh-token row was not found');
    }

    expect(expiredRow.expiresAt.getTime()).toBeLessThan(Date.now());
    expect(expiredRow.revokedAt).toBeNull();

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({
        refreshToken: expiredRefreshToken,
      })
      .expect(401);

    const afterAttempt = await refreshTokenRepository.findOne({
      where: {
        id: tokenRow.id,
      },
    });

    expect(afterAttempt).not.toBeNull();

    if (!afterAttempt) {
      throw new Error('Expected refresh-token row after rejection');
    }

    expect(afterAttempt.revokedAt).toBeNull();
  });

});