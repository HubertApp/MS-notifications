import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationsService } from './ms-notifications.service';
import { NotificationsResolver, UsersResolver } from './ms-notifications.resolver';
import { NotificationsController } from './ms-notifications.controller';
import {
  NotificationMongooseSchema,
  NotificationSchema,
} from './schema/notification.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: NotificationMongooseSchema.name, schema: NotificationSchema },
    ]),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsResolver,
    UsersResolver
  ],

  exports: [NotificationsService],
})
export class NotificationsModule {}
