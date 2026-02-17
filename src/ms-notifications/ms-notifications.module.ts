import { Module } from '@nestjs/common';
import { NotificationsService } from './ms-notifications.service';
import { NotificationsResolver, UsersResolver } from './ms-notifications.resolver';
import { NotificationsController } from './ms-notifications.controller';

@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsResolver,
    UsersResolver
  ],
  
  exports: [NotificationsService], 
})
export class NotificationsModule {}