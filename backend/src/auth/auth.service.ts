import { Injectable, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { DataSource, IsNull, Repository } from 'typeorm';

import { CategoriesService } from '../categories/categories.service';
import { EnvironmentVariables } from '../config/env.validation';
import { UserResponseDto } from '../users/dto/user-response.dto';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { AuthResponseDto } from './dto/auth-response.dto';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { MailerPort } from './mail/mailer.port';
import { PasswordService } from './password.service';

const CREDENCIAIS_INVALIDAS = 'E-mail ou senha invalidos.';

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

@Injectable()
export class AuthService implements OnModuleInit {
  private dummyHash = '';

  constructor(
    private readonly users: UsersService,
    private readonly passwords: PasswordService,
    private readonly categories: CategoriesService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
    private readonly dataSource: DataSource,
    private readonly mailer: MailerPort,
    @InjectRepository(RefreshToken)
    private readonly refreshTokens: Repository<RefreshToken>,
    @InjectRepository(PasswordResetToken)
    private readonly resetTokens: Repository<PasswordResetToken>,
  ) {}

  async onModuleInit(): Promise<void> {
    this.dummyHash = await this.passwords.hash(randomBytes(32).toString('hex'));
  }

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const user = await this.dataSource.transaction(async (manager) => {
      const created = await this.users.create(
        {
          email: dto.email,
          passwordHash: await this.passwords.hash(dto.password),
          name: dto.name,
        },
        manager,
      );

      await this.categories.seedDefaults(created.id, manager);

      return created;
    });

    return this.issueSession(user);
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.users.findByEmailWithPassword(dto.email);

    if (!user) {
      await this.passwords.verify(this.dummyHash, dto.password);
      throw new UnauthorizedException(CREDENCIAIS_INVALIDAS);
    }

    const ok = await this.passwords.verify(user.passwordHash, dto.password);
    if (!ok) {
      throw new UnauthorizedException(CREDENCIAIS_INVALIDAS);
    }

    return this.issueSession(user);
  }

  async refresh(presentedToken: string): Promise<AuthResponseDto> {
    const tokenHash = sha256(presentedToken);
    const stored = await this.refreshTokens.findOne({ where: { tokenHash } });

    if (!stored) {
      throw new UnauthorizedException('Refresh token invalido.');
    }

    if (stored.revokedAt !== null) {
      await this.revokeFamily(stored.userId, stored.familyId);
      throw new UnauthorizedException('Sessao revogada por reuso de token.');
    }

    if (stored.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Refresh token expirado.');
    }

    const user = await this.users.findById(stored.userId);
    if (!user) {
      throw new UnauthorizedException('Refresh token invalido.');
    }

    return this.issueSession(user, stored);
  }

  async logout(presentedToken: string): Promise<void> {
    const stored = await this.refreshTokens.findOne({
      where: { tokenHash: sha256(presentedToken) },
    });
    if (stored) {
      await this.revokeFamily(stored.userId, stored.familyId);
    }
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.users.findByEmail(email);
    if (!user) {
      return;
    }

    const ttlMinutes = this.config.get('PASSWORD_RESET_TTL_MINUTES', { infer: true });
    const token = randomBytes(32).toString('base64url');

    await this.resetTokens.save(
      this.resetTokens.create({
        userId: user.id,
        tokenHash: sha256(token),
        expiresAt: new Date(Date.now() + ttlMinutes * 60_000),
        usedAt: null,
      }),
    );

    const appUrl = this.config.get('APP_URL', { infer: true }).replace(/\/+$/, '');
    await this.mailer.sendPasswordReset({
      to: user.email,
      name: user.name,
      resetUrl: `${appUrl}/redefinir-senha?token=${token}`,
      expiresInMinutes: ttlMinutes,
    });
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const stored = await this.resetTokens.findOne({ where: { tokenHash: sha256(token) } });

    if (!stored || stored.usedAt !== null || stored.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Token de redefinicao invalido ou expirado.');
    }

    const passwordHash = await this.passwords.hash(newPassword);

    await this.dataSource.transaction(async (manager) => {
      await this.users.updatePassword(stored.userId, passwordHash, manager);
      await manager.update(PasswordResetToken, { id: stored.id }, { usedAt: new Date() });
      await manager.update(
        RefreshToken,
        { userId: stored.userId, revokedAt: IsNull() },
        { revokedAt: new Date() },
      );
    });
  }

  private async issueSession(user: User, rotated?: RefreshToken): Promise<AuthResponseDto> {
    const familyId = rotated ? rotated.familyId : randomUUID();
    const refreshToken = randomBytes(32).toString('base64url');
    const ttlDays = this.config.get('REFRESH_TTL_DAYS', { infer: true });

    const created = await this.refreshTokens.save(
      this.refreshTokens.create({
        userId: user.id,
        familyId,
        tokenHash: sha256(refreshToken),
        expiresAt: new Date(Date.now() + ttlDays * 86_400_000),
        revokedAt: null,
      }),
    );

    if (rotated) {
      await this.refreshTokens.update(
        { id: rotated.id },
        { revokedAt: new Date(), replacedById: created.id },
      );
    }

    const accessToken = await this.jwt.signAsync(
      { sub: user.id, email: user.email, sid: familyId },
      {
        secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
        expiresIn: this.config.get('JWT_ACCESS_TTL', { infer: true }),
      },
    );

    const { exp } = this.jwt.decode<{ exp: number }>(accessToken);

    return {
      user: UserResponseDto.from(user),
      accessToken,
      refreshToken,
      expiresIn: Math.max(0, exp - Math.floor(Date.now() / 1000)),
      tokenType: 'Bearer',
    };
  }

  private async revokeFamily(userId: string, familyId: string): Promise<void> {
    await this.refreshTokens.update(
      { userId, familyId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }
}
