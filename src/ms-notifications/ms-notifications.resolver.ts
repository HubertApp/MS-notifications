// src/ms-notifications/ms-notifications.resolver.ts
import { Resolver, Query, Mutation, Args, ResolveField, Parent } from '@nestjs/graphql';
import { ForbiddenException, UseGuards } from '@nestjs/common';
import { NotificationsService } from './ms-notifications.service';
import { FederatedAuthGuard, AuthenticatedUser } from '../common/guards/federated-auth.guard';
import { CurrentUser } from '../common/decorator/current-user.decorator';

@Resolver('User')
export class UsersResolver {
  constructor(private readonly notificationsService: NotificationsService) {}

  @ResolveField('notifications')
  @UseGuards(FederatedAuthGuard)
  getNotifications(@Parent() user: { id: string }) {
    return this.notificationsService.findForUser(user.id);
  }
}

@Resolver('Notification')
export class NotificationsResolver {
  constructor(private readonly notificationsService: NotificationsService) {}

  // Protégée par FederatedAuthGuard, ne renvoie que les notifications de
  // l'appelant authentifié. Le nom "getAllNotifications" est conservé pour
  // ne pas casser le contrat GraphQL existant, mais il est trompeur : c'est
  // en réalité "mes notifications".
  @Query('getAllNotifications')
  @UseGuards(FederatedAuthGuard)
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.findForUser(user.userId);
  }

  // Mutation authentifiée. Un utilisateur normal ne peut créer une
  // notification que pour lui-même ; seul un appelant avec le rôle "SERVICE"
  // (communication interservices via le gateway) peut en créer pour un tiers.
  @Mutation('createNotification')
  @UseGuards(FederatedAuthGuard)
  create(
    @Args('userId') userId: string,
    @Args('content') content: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (user.role !== 'SERVICE' && userId !== user.userId) {
      throw new ForbiddenException(
        'Vous ne pouvez pas créer de notification pour un autre utilisateur.',
      );
    }

    return this.notificationsService.create({
      userId,
      content,
      type: user.role === 'SERVICE' ? 'SERVICE' : 'MANUAL',
      source: 'graphql:createNotification',
      triggeredBy: user.userId,
    });
  }
}
