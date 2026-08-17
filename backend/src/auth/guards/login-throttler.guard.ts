import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';

@Injectable()
export class LoginThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: Request): Promise<string> {
    const body = req.body as { email?: unknown } | undefined;
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : 'sem-email';
    const ip = req.ips?.length ? req.ips[0] : req.ip;
    return Promise.resolve(`login:${ip ?? 'sem-ip'}:${email}`);
  }
}
