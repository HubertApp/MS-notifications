import { GqlExecutionContext } from '@nestjs/graphql';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

export interface AuthenticatedUser {
  userId: string;
  role: string;
  email?: string;
}

@Injectable()
export class FederatedAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const ctx = GqlExecutionContext.create(context).getContext();
    const headers = ctx.req.headers;

    const authState = headers['x-auth-state'];
    const userId = headers['x-user-id'];

    if (authState && authState !== 'VALID') {
      throw new UnauthorizedException('Token invalide');
    }
    if (!userId) {
      throw new UnauthorizedException('Connexion requise');
    }

    ctx.req.user = {
      userId: String(userId),
      role: headers['x-user-role'] ? String(headers['x-user-role']) : 'USER',
      email: headers['x-user-email']
        ? String(headers['x-user-email'])
        : undefined,
    } as AuthenticatedUser;

    return true;
  }
}
