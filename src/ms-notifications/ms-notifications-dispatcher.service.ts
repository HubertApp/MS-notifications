import { Injectable, Logger } from '@nestjs/common';
import {
  CreateNotificationParams,
  NotificationsService,
} from './ms-notifications.service';
import { Notification } from './entities/notification.entity';
import { NotificationDeliveryPublisher } from './notification-delivery.publisher';

export interface DispatchNotificationParams extends CreateNotificationParams {
  // Canaux additionnels demandés en plus de la persistance in-app, ex:
  // ['EMAIL']. IN_APP est toujours implicite (voir NotificationsService.create)
  // et n'engendre jamais de job : il n'y a rien à livrer, c'est déjà fait.
  channels?: string[];
  // Réservé aux appelants internes de confiance (ex: le controller RabbitMQ,
  // qui a déjà l'e-mail dans le payload de l'événement) : évite un
  // aller-retour réseau vers MS-User. JAMAIS exposé comme argument GraphQL
  // (voir le resolver et UserLookupService) : un client ne doit jamais
  // pouvoir dicter à quelle adresse un mail est envoyé pour un userId donné.
  recipientEmail?: string;
}

// Orchestrateur : persiste toujours la notification (source de vérité), puis
// publie un job de livraison par canal demandé sur la queue RabbitMQ
// "notification_delivery_queue" (voir NotificationDeliveryPublisher /
// NotificationDeliveryConsumer). Le dispatcher lui-même n'appelle plus
// aucune stratégie de canal directement : sa seule responsabilité est
// persistance + publication, toutes deux rapides et fiables. C'est le
// consumer (un process séparé du point de vue logique, même s'il tourne
// dans le même pod pour l'instant) qui exécute réellement l'envoi, avec
// retries et dead-letter en cas d'échec — voir notification-delivery.consumer.ts.
@Injectable()
export class NotificationDispatcherService {
  private readonly logger = new Logger(NotificationDispatcherService.name);

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly deliveryPublisher: NotificationDeliveryPublisher,
  ) {}

  async dispatch(params: DispatchNotificationParams): Promise<Notification> {
    const { channels: requestedTypes = [], recipientEmail, ...createParams } = params;

    const notification = await this.notificationsService.create(createParams);

    for (const channelType of requestedTypes) {
      if (channelType === 'IN_APP') continue;

      await this.deliveryPublisher.publish({
        notificationId: notification.id,
        userId: params.userId,
        content: notification.content,
        type: notification.type,
        channelType,
        email: recipientEmail,
      });
    }

    return notification;
  }
}
