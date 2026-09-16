import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import type {
  AuthenticatedUser,
  FederatedRequest,
} from '../guards/federated-auth.guard';

export const CurrentUser = createParamDecorator(
  (data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const ctx = GqlExecutionContext.create(context);
    return ctx.getContext<{ req: FederatedRequest }>().req
      .user as AuthenticatedUser;
  },
);
