import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';

import { AuthenticatedRequest, AuthenticatedUser } from '../types/authenticated-request';

export const CurrentUser = createParamDecorator(
  (field: keyof AuthenticatedUser | undefined, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException();
    }

    return field ? user[field] : user;
  },
);
