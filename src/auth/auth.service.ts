import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { RefreshToken } from '../entities/RefreshToken';
import { User } from '../entities/User';
import { LogoutDto } from './dto/logout.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import type { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,

    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
  ) {}

  async register(registerDto: RegisterDto) {
    const email = registerDto.email.trim().toLowerCase();

    const existingUser = await this.userRepository.findOne({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await argon2.hash(registerDto.password, {
      type: argon2.argon2id,
      memoryCost: this.configService.getOrThrow<number>(
        'ARGON2_MEMORY_COST',
      ),
      timeCost: this.configService.getOrThrow<number>(
        'ARGON2_TIME_COST',
      ),
      parallelism: this.configService.getOrThrow<number>(
        'ARGON2_PARALLELISM',
      ),
    });

    const user = this.userRepository.create({
      name: registerDto.name.trim(),
      email,
      passwordHash,
    });

    const savedUser = await this.userRepository.save(user);

    return {
      id: savedUser.id,
      name: savedUser.name,
      email: savedUser.email,
    };
  }

  async login(loginDto: LoginDto) {
    const email = loginDto.email.trim().toLowerCase();

    const user = await this.userRepository.findOne({
      where: { email },
    });

    if (!user?.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordValid = await argon2.verify(
      user.passwordHash,
      loginDto.password,
    );

    if (!passwordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.issueTokenPair(
      user,
      this.refreshTokenRepository,
      randomUUID(),
    );
  }

  async refresh(refreshDto: RefreshDto) {
    const refreshTokenHash = this.hashToken(refreshDto.refreshToken);

    let reuseDetected = false;

    const result = await this.dataSource.transaction(async (manager) => {
      const refreshTokenRepository = manager.getRepository(RefreshToken);
      const userRepository = manager.getRepository(User);

      const storedToken = await refreshTokenRepository.findOne({
        where: { tokenHash: refreshTokenHash },
      });

      if (!storedToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      if (storedToken.revokedAt !== null) {
        await refreshTokenRepository.update(
          { familyId: storedToken.familyId },
          { revokedAt: new Date() },
        );

        reuseDetected = true;

        return undefined;
      }

      if (storedToken.expiresAt.getTime() <= Date.now()) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const user = await userRepository.findOne({
        where: { id: storedToken.userId },
      });

      if (!user) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      storedToken.revokedAt = new Date();
      await refreshTokenRepository.save(storedToken);

      return this.issueTokenPair(
        user,
        refreshTokenRepository,
        storedToken.familyId,
      );
    });

    if (reuseDetected) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return result;
  }

  async logout(logoutDto: LogoutDto) {
    const refreshTokenHash = this.hashToken(logoutDto.refreshToken);

    const storedToken = await this.refreshTokenRepository.findOne({
      where: { tokenHash: refreshTokenHash },
    });

    if (!storedToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (storedToken.revokedAt === null) {
      storedToken.revokedAt = new Date();
      await this.refreshTokenRepository.save(storedToken);
    }

    return {
      message: 'Logged out successfully',
    };
  }

  private async issueTokenPair(
    user: User,
    refreshTokenRepository: Repository<RefreshToken>,
    familyId: string,
  ) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
    };

    const jwtSecret = this.configService.getOrThrow<string>('JWT_SECRET');

    const accessExpiresIn =
      this.configService.getOrThrow<string>('JWT_ACCESS_EXPIRES_IN');

    const refreshExpiresIn =
      this.configService.getOrThrow<string>('JWT_REFRESH_EXPIRES_IN');

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: jwtSecret,
      expiresIn: accessExpiresIn as `${number}${'s' | 'm' | 'h' | 'd'}`,
    });

    const refreshToken = randomBytes(32).toString('base64url');

    const refreshTokenHash = this.hashToken(refreshToken);

    const refreshTokenEntity = refreshTokenRepository.create({
      userId: user.id,
      familyId,
      tokenHash: refreshTokenHash,
      expiresAt: new Date(
        Date.now() + this.parseDuration(refreshExpiresIn),
      ),
      revokedAt: null,
    });

    await refreshTokenRepository.save(refreshTokenEntity);

    return {
      accessToken,
      refreshToken,
    };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private parseDuration(duration: string): number {
    const match = /^(\d+)(s|m|h|d)$/.exec(duration.trim());

    if (!match) {
      throw new Error(
        'Invalid token duration. Use a value such as 15m, 1h, or 7d.',
      );
    }

    const value = Number(match[1]);
    const unit = match[2];

    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };

    return value * multipliers[unit];
  }
}
