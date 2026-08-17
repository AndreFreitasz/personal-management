import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CategoriesModule } from '../categories/categories.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LogMailer } from './mail/log-mailer';
import { MailerPort } from './mail/mailer.port';
import { PasswordService } from './password.service';
import { SessionsService } from './sessions.service';

@Module({
  imports: [
    ConfigModule,
    UsersModule,
    CategoriesModule,
    TypeOrmModule.forFeature([RefreshToken, PasswordResetToken]),
    JwtModule.register({}),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    SessionsService,
    { provide: MailerPort, useClass: LogMailer },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
  exports: [AuthService, SessionsService],
})
export class AuthModule {}
