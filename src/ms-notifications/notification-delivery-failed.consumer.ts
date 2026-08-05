import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { NOTIFICATION_DELIVERY_FAILED_PATTERN } from './notification-delivery.publisher';
import type { NotificationDeliveryJob } from './notification-delivery.publisher';

// Consomme la queue "notification_delivery_failed_queue" (voir main.ts) :
// uniquement de l'observabilité, pour que les échecs définitifs de livraison
// apparaissent clairement dans les logs plutôt que de rester invisibles
// dans une queue que personne ne regarde. Ack automatique (pas de retry ici,
// c'est déjà le bout de la chaîne).
@Controller()
export class NotificationDeliveryFailedConsumer {
  private readonly logger = new Logger(NotificationDeliveryFailedConsumer.name);

  @EventPattern(NOTIFICATION_DELIVERY_FAILED_PATTERN)
  handleFailedDelivery(
    @Payload() job: NotificationDeliveryJob & { failureReason: string; failedAt: string },
  ): void {
    this.logger.error(
      `Livraison abandonnée définitivement : canal="${job.channelType}" notif=${job.notificationId} user_id=${job.userId} après ${job.attempts} essais. Raison : ${job.failureReason}`,
    );
  }
}
