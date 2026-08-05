import { Controller, Inject, Logger } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import {
  NOTIFICATION_DELIVERY_PATTERN,
  NotificationDeliveryPublisher,
} from './notification-delivery.publisher';
import type { NotificationDeliveryJob } from './notification-delivery.publisher';
import { NOTIFICATION_CHANNELS } from './channels/notification-channel.interface';
import type {
  NotificationChannel,
  NotificationRecipient,
} from './channels/notification-channel.interface';
import { UserLookupService } from './user-lookup.service';

const MAX_ATTEMPTS = 5;

// Backoff volontairement simple (pas de plugin RabbitMQ de délai/priorité) :
// on attend un peu avant de republier, la durée grandit avec le nombre
// d'essais, plafonnée à 10s. Pendant ce délai, ce consumer ne traite pas
// d'autre job (voir la doc du service pour ce compromis assumé).
const backoffMs = (attempts: number) => Math.min(attempts * 2000, 10000);
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Consomme la queue "notification_delivery_queue" (voir main.ts). C'est ici,
// et seulement ici, que le pattern Stratégie (NotificationChannel) est
// réellement exécuté : le dispatcher ne fait plus que publier des jobs.
@Controller()
export class NotificationDeliveryConsumer {
  private readonly logger = new Logger(NotificationDeliveryConsumer.name);

  constructor(
    private readonly userLookup: UserLookupService,
    private readonly publisher: NotificationDeliveryPublisher,
    @Inject(NOTIFICATION_CHANNELS)
    private readonly channels: NotificationChannel[],
  ) {}

  @EventPattern(NOTIFICATION_DELIVERY_PATTERN)
  async handleDelivery(
    @Payload() job: NotificationDeliveryJob,
    @Ctx() context: RmqContext,
  ): Promise<void> {
    const channelRef = context.getChannelRef();
    const originalMsg = context.getMessage();

    const channel = this.channels.find((c) => c.type === job.channelType);
    if (!channel) {
      this.logger.warn(
        `Job reçu pour un canal inconnu "${job.channelType}" (notif ${job.notificationId}), abandonné.`,
      );
      channelRef.ack(originalMsg);
      return;
    }

    try {
      const email = job.email ?? (await this.userLookup.getEmailForUser(job.userId));
      const recipient: NotificationRecipient = { userId: job.userId, email };

      if (!channel.supports(recipient)) {
        this.logger.warn(
          `Canal "${job.channelType}" non utilisable pour user_id=${job.userId} (donnée manquante), job abandonné.`,
        );
        channelRef.ack(originalMsg);
        return;
      }

      await channel.send(
        {
          id: job.notificationId,
          userId: job.userId,
          content: job.content,
          type: job.type,
          source: '',
          isRead: false,
          createdAt: new Date().toISOString(),
        },
        recipient,
      );

      this.logger.log(
        `Livraison "${job.channelType}" réussie pour la notif ${job.notificationId} (essai ${job.attempts + 1}).`,
      );
      channelRef.ack(originalMsg);
    } catch (err) {
      await this.handleFailure(job, err, channelRef, originalMsg);
    }
  }

  private async handleFailure(
    job: NotificationDeliveryJob,
    err: unknown,
    channelRef: { ack: (msg: unknown) => void },
    originalMsg: unknown,
  ): Promise<void> {
    const attempts = job.attempts + 1;
    const reason = err instanceof Error ? err.message : String(err);

    this.logger.warn(
      `Échec de livraison "${job.channelType}" pour la notif ${job.notificationId} (essai ${attempts}/${MAX_ATTEMPTS}) : ${reason}`,
    );

    if (attempts >= MAX_ATTEMPTS) {
      this.logger.error(
        `Abandon définitif de la livraison "${job.channelType}" pour la notif ${job.notificationId} après ${attempts} essais.`,
      );
      await this.publisher.publishFailed({ ...job, attempts }, reason);
      channelRef.ack(originalMsg);
      return;
    }

    // On accuse réception du message original (il ne sera pas redélivré tel
    // quel par RabbitMQ) puis on republie nous-mêmes une copie à jour avec le
    // compteur incrémenté — c'est ce qui permet de suivre "attempts" alors
    // que RabbitMQ lui-même ne modifie jamais le contenu d'un message.
    await delay(backoffMs(attempts));
    await this.publisher.publishJob({ ...job, attempts });
    channelRef.ack(originalMsg);
  }
}
