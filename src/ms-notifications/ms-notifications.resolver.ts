// src/ms-notifications/ms-notifications.resolver.ts
import { Resolver, Query, Mutation, Args, ResolveField, Parent } from '@nestjs/graphql';
import { ForbiddenException, UseGuards } from '@nestjs/common';
import { NotificationsService } from './ms-notifications.service';
import { NotificationDispatcherService } from './ms-notifications-dispatcher.service';
import { FederatedAuthGuard } from '../common/guards/federated-auth.guard';
import type { AuthenticatedUser } from '../common/guards/federated-auth.guard';
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
  constructor(private readonly dispatcher: NotificationDispatcherService, private readonly notificationsService: NotificationsService) {}

  // Ne renvoie que les notifications de l'appelant, voir ARCHITECTURE.md §6.
  @Query('getAllNotifications')
  @UseGuards(FederatedAuthGuard)
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.findForUser(user.userId);
  }

  // Pas d'argument `email` : résolution toujours côté serveur, voir ARCHITECTURE.md §4.
  @Mutation('createNotification')
  @UseGuards(FederatedAuthGuard)
  create(
    @Args('userId') userId: string,
    @Args('content') content: string,
    @Args('channels') channels: string[] | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (user.role !== 'SERVICE' && userId !== user.userId) {
      throw new ForbiddenException(
        'Vous ne pouvez pas créer de notification pour un autre utilisateur.',
      );
    }

    return this.dispatcher.dispatch({
      userId,
      content,
      type: user.role === 'SERVICE' ? 'SERVICE' : 'MANUAL',
      source: 'graphql:createNotification',
      triggeredBy: user.userId,
      channels,
    });
  }

  @Mutation('markNotificationAsRead')
  @UseGuards(FederatedAuthGuard)
  markAsRead(@Args('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.markAsRead(id, user.userId, user.role);
  }
}
