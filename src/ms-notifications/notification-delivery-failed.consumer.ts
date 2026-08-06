import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { NOTIFICATION_DELIVERY_FAILED_PATTERN } from './notification-delivery.publisher';
import type { NotificationDeliveryJob } from './notification-delivery.publisher';

// Dead-letter : observabilité uniquement. Voir ARCHITECTURE.md §5.
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
