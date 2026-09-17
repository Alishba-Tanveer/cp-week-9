import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import * as argon2 from 'argon2';

import { RefreshToken } from '../entities/RefreshToken';
import { User } from '../entities/User';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const userRepository = {
    findOne: jest.fn<() => Promise<User | null>>(),
    create: jest.fn<(data: Partial<User>) => User>(),
    save: jest.fn<(user: User) => Promise<User>>(),
  };

  const refreshTokenRepository = {
    findOne: jest.fn<() => Promise<RefreshToken | null>>(),
    create: jest.fn<(data: Partial<RefreshToken>) => RefreshToken>(),
    save: jest.fn<(token: RefreshToken) => Promise<RefreshToken>>(),
  };

  const jwtService = {
    signAsync: jest.fn<() => Promise<string>>(),
  };

  const configService = {
    getOrThrow: jest.fn((key: string): string => {
      const values: Record<string, string> = {
        JWT_SECRET: 'test-secret-that-is-at-least-32-characters-long',
        JWT_ACCESS_EXPIRES_IN: '15m',
        JWT_REFRESH_EXPIRES_IN: '7d',
        ARGON2_MEMORY_COST: '16384',
        ARGON2_TIME_COST: '1',
        ARGON2_PARALLELISM: '1',
      };

      return values[key];
    }),
  };

  type TransactionUserRepository = {
    findOne: () => Promise<User | null>;
  };

  type TransactionRefreshRepository = {
    findOne: () => Promise<RefreshToken | null>;
    create: (data: Partial<RefreshToken>) => RefreshToken;
    save: (token: RefreshToken) => Promise<RefreshToken>;
    update: jest.Mock;
  };

  type TransactionManager = {
    getRepository: (
      entity: typeof User | typeof RefreshToken,
    ) => TransactionUserRepository | TransactionRefreshRepository;
  };

  const dataSource = {
    transaction: jest.fn<
      (
        callback: (manager: TransactionManager) => Promise<unknown>,
      ) => Promise<unknown>
    >(),
  };

  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();

    service = new AuthService(
      userRepository as never,
      refreshTokenRepository as never,
      jwtService as never,
      configService as never,
      dataSource as never,
    );
  });

  describe('registration password hashing', () => {
    it('uses the configured Argon2 cost parameters', async () => {
      const password = 'ConfiguredPassword123!';

      const user: User = {
        id: 1,
        name: 'Configured User',
        email: 'configured@example.com',
        passwordHash: null,
        createdAt: new Date(),
      };

      userRepository.findOne.mockResolvedValue(null);

      userRepository.create.mockImplementation(
        (data: Partial<User>) => data as User,
      );

      userRepository.save.mockImplementation(
        async (savedUser: User) => ({
          ...savedUser,
          id: 1,
          createdAt: new Date(),
        }),
      );

      const result = await service.register({
        name: user.name,
        email: user.email,
        password,
      });

      const savedUser = userRepository.save.mock.calls[0][0];

      expect(result).toEqual({
        id: 1,
        name: 'Configured User',
        email: 'configured@example.com',
      });

      expect(savedUser.passwordHash).toEqual(expect.any(String));

      if (!savedUser.passwordHash) {
        throw new Error('Expected password hash to be generated');
      }

      expect(savedUser.passwordHash).toContain('$argon2id$');
      expect(savedUser.passwordHash).toContain('m=16384');
      expect(savedUser.passwordHash).toContain('t=1');
      expect(savedUser.passwordHash).toContain('p=1');

      await expect(
        argon2.verify(savedUser.passwordHash, password),
      ).resolves.toBe(true);

      expect(result).not.toHaveProperty('password');
      expect(result).not.toHaveProperty('passwordHash');
    });
  });

  describe('login password verification', () => {
    it('accepts the correct password', async () => {
      const password = 'CorrectPassword123!';
      const passwordHash = await argon2.hash(password);

      const user: User = {
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        passwordHash,
        createdAt: new Date(),
      };

      userRepository.findOne.mockResolvedValue(user);

      jwtService.signAsync.mockResolvedValue('access-token');

      refreshTokenRepository.create.mockImplementation(
        (data: Partial<RefreshToken>) => data as RefreshToken,
      );

      refreshTokenRepository.save.mockResolvedValue({
        id: 1,
        userId: user.id,
        familyId: '11111111-1111-1111-1111-111111111111',
        tokenHash: 'test-hash',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        revokedAt: null,
        createdAt: new Date(),
        user,
      });

      const result = await service.login({
        email: 'test@example.com',
        password,
      });

      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toEqual(expect.any(String));
      expect(refreshTokenRepository.save).toHaveBeenCalled();
    });

    it('rejects an incorrect password', async () => {
      const passwordHash = await argon2.hash('CorrectPassword123!');

      const user: User = {
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        passwordHash,
        createdAt: new Date(),
      };

      userRepository.findOne.mockResolvedValue(user);

      await expect(
        service.login({
          email: 'test@example.com',
          password: 'WrongPassword123!',
        }),
      ).rejects.toThrow('Invalid email or password');
    });
  });

  describe('refresh rotation', () => {
    it('revokes the old refresh token and issues a new pair', async () => {
      const oldToken = 'old-refresh-token';
      const familyId = '22222222-2222-2222-2222-222222222222';

      const user: User = {
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        passwordHash: 'hash',
        createdAt: new Date(),
      };

      const storedToken: RefreshToken = {
        id: 1,
        userId: 1,
        familyId,
        tokenHash: 'old-token-hash',
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: null,
        createdAt: new Date(),
        user,
      };

      const transactionalRefreshRepository = {
        findOne: jest
          .fn<() => Promise<RefreshToken | null>>()
          .mockResolvedValue(storedToken),

        create: jest
          .fn<(data: Partial<RefreshToken>) => RefreshToken>()
          .mockImplementation(
            (data: Partial<RefreshToken>) => data as RefreshToken,
          ),

        save: jest
          .fn<(token: RefreshToken) => Promise<RefreshToken>>()
          .mockResolvedValue(storedToken),

        update: jest.fn(),
      };

      const transactionalUserRepository = {
        findOne: jest
          .fn<() => Promise<User | null>>()
          .mockResolvedValue(user),
      };

      dataSource.transaction.mockImplementation(
        async (callback: (manager: TransactionManager) => Promise<unknown>) =>
          callback({
            getRepository: (entity: typeof User | typeof RefreshToken) =>
              entity === RefreshToken
                ? transactionalRefreshRepository
                : transactionalUserRepository,
          }),
      );

      jwtService.signAsync.mockResolvedValue('new-access-token');

      const result = await service.refresh({
        refreshToken: oldToken,
      });

      expect(storedToken.revokedAt).toBeInstanceOf(Date);

      expect(transactionalRefreshRepository.save).toHaveBeenCalledWith(
        storedToken,
      );

      expect(
        transactionalRefreshRepository.create,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: user.id,
          familyId,
          revokedAt: null,
        }),
      );

      expect(result).toBeDefined();

      if (!result) {
        throw new Error('Expected refresh token rotation result');
      }

      expect(result.accessToken).toBe('new-access-token');
      expect(result.refreshToken).toEqual(expect.any(String));
    });

    it('rejects an expired refresh token', async () => {
      const expiredToken: RefreshToken = {
        id: 2,
        userId: 1,
        familyId: '33333333-3333-3333-3333-333333333333',
        tokenHash: 'expired-token-hash',
        expiresAt: new Date(Date.now() - 60_000),
        revokedAt: null,
        createdAt: new Date(),
        user: {
          id: 1,
          name: 'Expired Token User',
          email: 'expired@example.com',
          passwordHash: 'hash',
          createdAt: new Date(),
        },
      };

      const transactionalRefreshRepository = {
        findOne: jest
          .fn<() => Promise<RefreshToken | null>>()
          .mockResolvedValue(expiredToken),

        create: jest
          .fn<(data: Partial<RefreshToken>) => RefreshToken>()
          .mockImplementation(
            (data: Partial<RefreshToken>) => data as RefreshToken,
          ),

        save: jest.fn<
          (token: RefreshToken) => Promise<RefreshToken>
        >(),

        update: jest.fn(),
      };

      const transactionalUserRepository = {
        findOne: jest.fn<() => Promise<User | null>>(),
      };

      dataSource.transaction.mockImplementation(
        async (callback: (manager: TransactionManager) => Promise<unknown>) =>
          callback({
            getRepository: (entity: typeof User | typeof RefreshToken) =>
              entity === RefreshToken
                ? transactionalRefreshRepository
                : transactionalUserRepository,
          }),
      );

      await expect(
        service.refresh({
          refreshToken: 'expired-refresh-token',
        }),
      ).rejects.toThrow('Invalid refresh token');

      expect(
        transactionalRefreshRepository.save,
      ).not.toHaveBeenCalled();

      expect(
        transactionalRefreshRepository.update,
      ).not.toHaveBeenCalled();

      expect(
        transactionalUserRepository.findOne,
      ).not.toHaveBeenCalled();
    });
  });
});
