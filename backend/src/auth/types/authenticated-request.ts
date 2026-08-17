import type { Request } from 'express';

export interface AuthenticatedUser {
  id: string;
  email: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export interface AccessTokenPayload {
  sub: string;
  email: string;
  sid: string;
}
