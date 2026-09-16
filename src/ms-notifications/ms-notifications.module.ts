import { readFileSync } from 'fs';
import { Logger, Module } from '@nestjs/common';
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

const RABBITMQ_URL =
  process.env.RABBITMQ_URL || 'amqps://user:password@rabbitmq:5671';
const RABBITMQ_CA_PATH = process.env.RABBITMQ_CA_PATH || '/etc/tls/ca.pem';

// Le certificat est lu au moment de construire les options, pas au chargement
// du module. Un readFileSync au niveau du fichier faisait planter tout import
// de AppModule sur une machine sans /etc/tls/ca.pem — donc les tests e2e, et
// tout démarrage local en TLS sans le certificat monté.
function buildSocketOptions(): { ca: Buffer[] } | undefined {
  if (!RABBITMQ_URL.startsWith('amqps://')) {
    return undefined;
  }
  try {
    return { ca: [readFileSync(RABBITMQ_CA_PATH)] };
  } catch {
    // Pas de certificat disponible : on laisse amqplib utiliser le magasin
    // système plutôt que d'empêcher l'application de démarrer. On le signale,
    // car en production c'est une anomalie de déploiement (certificat non monté)
    // et la connexion au broker échouera ensuite si son certificat est privé.
    new Logger('MsNotificationsModule').warn(
      `Certificat CA introuvable (${RABBITMQ_CA_PATH}) alors que RABBITMQ_URL ` +
        `est en amqps. Connexion TLS tentée avec le magasin système.`,
    );
    return undefined;
  }
}

const socketOptions = buildSocketOptions();

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: NotificationMongooseSchema.name, schema: NotificationSchema },
    ]),

    ClientsModule.register([
      {
        name: NOTIFICATION_DELIVERY_CLIENT,
        transport: Transport.RMQ,
        options: {
          urls: [RABBITMQ_URL],
          queue: 'notification_delivery_queue',
          socketOptions,
          queueOptions: { durable: true },
        },
      },
      {
        name: NOTIFICATION_DELIVERY_FAILED_CLIENT,
        transport: Transport.RMQ,
        options: {
          urls: [RABBITMQ_URL],
          queue: 'notification_delivery_failed_queue',
          socketOptions,
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

    { provide: MAIL_PROVIDER, useClass: SmtpMailProvider },

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
