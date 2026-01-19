// src/ms-notifications/ms-notifications.resolver.ts
import { Resolver, Query, Mutation, Args, ResolveField, Parent } from '@nestjs/graphql';
import { NotificationsService } from './ms-notifications.service'; // Import mis à jour

@Resolver('User')
export class UsersResolver {
  // On injecte le service avec son nouveau nom
  constructor(private readonly notificationsService: NotificationsService) {}

  @ResolveField('notifications')
  getNotifications(@Parent() user: { id: string }) {
    return this.notificationsService.findForUser(user.id);
  }
}

@Resolver('Notification')
export class NotificationsResolver { // Nom de classe mis à jour
  constructor(private readonly notificationsService: NotificationsService) {}

  @Query('getAllNotifications')
  findAll() {
    return this.notificationsService.findAll();
  }

  @Mutation('createNotification')
  create(
    @Args('userId') userId: string,
    @Args('content') content: string,
  ) {
    return this.notificationsService.create(userId, content);
  }
}