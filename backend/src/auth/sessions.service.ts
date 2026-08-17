import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Repository } from 'typeorm';

import { RefreshToken } from './entities/refresh-token.entity';

@Injectable()
export class SessionsService {
  constructor(
    @InjectRepository(RefreshToken)
    private readonly refreshTokens: Repository<RefreshToken>,
  ) {}

  isActive(userId: string, familyId: string): Promise<boolean> {
    return this.refreshTokens.existsBy({
      userId,
      familyId,
      revokedAt: IsNull(),
      expiresAt: MoreThan(new Date()),
    });
  }
}
