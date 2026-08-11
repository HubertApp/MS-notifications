import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

// Voir ARCHITECTURE.md §5 pour le fonctionnement complet de la queue.
export interface NotificationDeliveryJob {
  notificationId: string;
  userId: string;
  content: string;
  type: string;
  channelType: string;
  email?: string;
  attempts: number;
}

export const NOTIFICATION_DELIVERY_CLIENT = 'NOTIFICATION_DELIVERY_CLIENT';
export const NOTIFICATION_DELIVERY_FAILED_CLIENT = 'NOTIFICATION_DELIVERY_FAILED_CLIENT';
export const NOTIFICATION_DELIVERY_PATTERN = 'notification_delivery';
export const NOTIFICATION_DELIVERY_FAILED_PATTERN = 'notification_delivery_failed';

@Injectable()
export class NotificationDeliveryPublisher {
  private readonly logger = new Logger(NotificationDeliveryPublisher.name);

  constructor(
    @Inject(NOTIFICATION_DELIVERY_CLIENT) private readonly client: ClientProxy,
    @Inject(NOTIFICATION_DELIVERY_FAILED_CLIENT)
    private readonly failedClient: ClientProxy,
  ) {}

  async publish(job: Omit<NotificationDeliveryJob, 'attempts'>): Promise<void> {
    await this.publishJob({ ...job, attempts: 0 });
  }

  async publishJob(job: NotificationDeliveryJob): Promise<void> {
    try {
      await firstValueFrom(this.client.emit(NOTIFICATION_DELIVERY_PATTERN, job));
    } catch (err) {
      this.logger.error(
        `Impossible de publier le job de livraison "${job.channelType}" pour la notif ${job.notificationId}.`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  async publishFailed(job: NotificationDeliveryJob, reason: string): Promise<void> {
    try {
      await firstValueFrom(
        this.failedClient.emit(NOTIFICATION_DELIVERY_FAILED_PATTERN, {
          ...job,
          failureReason: reason,
          failedAt: new Date().toISOString(),
        }),
      );
    } catch (err) {
      this.logger.error(
        `Impossible de publier l'échec définitif de livraison pour la notif ${job.notificationId}.`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
