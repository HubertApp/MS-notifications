import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { NotificationsService } from './ms-notifications.service';
import { NotificationDispatcherService } from './ms-notifications-dispatcher.service';
import { NotificationsResolver, UsersResolver } from './ms-notifications.resolver';
import { NotificationsController } from './ms-notifications.controller';
import {
  NotificationMongooseSchema,
  NotificationSchema,
} from './schema/notification.schema';
import { NOTIFICATION_CHANNELS, NotificationChannel } from './channels/notification-channel.interface';
import { InAppNotificationChannel } from './channels/in-app-notification.channel';
import { EmailNotificationChannel } from './channels/email-notification.channel';
import { MAIL_PROVIDER } from '../mail/mail-provider.interface';
import { SmtpMailProvider } from '../mail/smtp-mail.provider';
import { UserLookupService } from './user-lookup.service';
import {
  NOTIFICATION_DELIVERY_CLIENT,
  NOTIFICATION_DELIVERY_FAILED_CLIENT,
  NotificationDeliveryPublisher,
} from './notification-delivery.publisher';
import { NotificationDeliveryConsumer } from './notification-delivery.consumer';
import { NotificationDeliveryFailedConsumer } from './notification-delivery-failed.consumer';

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://rabbitmq:5672';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: NotificationMongooseSchema.name, schema: NotificationSchema },
    ]),

    // Clients de publication vers les deux queues de livraison. Voir main.ts
    // pour le côté consommateur (connectMicroservice), qui doit utiliser
    // exactement les mêmes noms de queue.
    ClientsModule.register([
      {
        name: NOTIFICATION_DELIVERY_CLIENT,
        transport: Transport.RMQ,
        options: {
          urls: [RABBITMQ_URL],
          queue: 'notification_delivery_queue',
          queueOptions: { durable: true },
        },
      },
      {
        name: NOTIFICATION_DELIVERY_FAILED_CLIENT,
        transport: Transport.RMQ,
        options: {
          urls: [RABBITMQ_URL],
          queue: 'notification_delivery_failed_queue',
          queueOptions: { durable: true },
        },
      },
    ]),
  ],
  controllers: [
    NotificationsController,
    NotificationDeliveryConsumer,
    NotificationDeliveryFailedConsumer,
  ],
  providers: [
    NotificationsService,
    NotificationDispatcherService,
    NotificationDeliveryPublisher,
    UserLookupService,
    NotificationsResolver,
    UsersResolver,

    // Provider mail (stratégie pour l'envoi effectif d'un e-mail). Pour
    // changer de fournisseur, il suffit de remplacer useClass ici.
    { provide: MAIL_PROVIDER, useClass: SmtpMailProvider },

    // Canaux de notification (pattern Stratégie), utilisés par
    // NotificationDeliveryConsumer — le dispatcher, lui, ne fait que publier
    // des jobs (voir ms-notifications-dispatcher.service.ts). Pour ajouter
    // un canal (SMS, push...) : créer la classe, l'ajouter aux providers et
    // à `inject`/paramètres du factory, sans toucher au consumer.
    InAppNotificationChannel,
    EmailNotificationChannel,
    {
      provide: NOTIFICATION_CHANNELS,
      useFactory: (
        inApp: InAppNotificationChannel,
        email: EmailNotificationChannel,
      ): NotificationChannel[] => [inApp, email],
      inject: [InAppNotificationChannel, EmailNotificationChannel],
    },
  ],

  exports: [NotificationsService, NotificationDispatcherService],
})
export class NotificationsModule {}
