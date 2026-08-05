import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

// Un "job" = une demande de livraison d'UNE notification sur UN canal
// (ex: l'e-mail de bienvenue de la notif WELCOME "notif-42"). Volontairement
// autoporteur (contient content/type, pas juste l'id) pour que le consumer
// n'ait pas besoin de retourner en base à chaque tentative.
export interface NotificationDeliveryJob {
  notificationId: string;
  userId: string;
  content: string;
  type: string;
  channelType: string;
  // Optionnel : si l'appelant connaît déjà l'e-mail (ex: event RabbitMQ
  // user_created, qui l'a dans son payload), on évite un aller-retour réseau
  // vers MS-User à chaque tentative. Sinon le consumer le résout lui-même.
  email?: string;
  attempts: number;
}

export const NOTIFICATION_DELIVERY_CLIENT = 'NOTIFICATION_DELIVERY_CLIENT';
export const NOTIFICATION_DELIVERY_FAILED_CLIENT = 'NOTIFICATION_DELIVERY_FAILED_CLIENT';
export const NOTIFICATION_DELIVERY_PATTERN = 'notification_delivery';
export const NOTIFICATION_DELIVERY_FAILED_PATTERN = 'notification_delivery_failed';

// Remplace l'ancien fire-and-forget en mémoire : publier ici, c'est écrire
// dans une queue RabbitMQ durable. Si le process de ce service crashe juste
// après, le job survit dans RabbitMQ et sera traité au redémarrage — c'est
// la garantie de durabilité qui manquait à la version précédente.
@Injectable()
export class NotificationDeliveryPublisher {
  private readonly logger = new Logger(NotificationDeliveryPublisher.name);

  constructor(
    @Inject(NOTIFICATION_DELIVERY_CLIENT) private readonly client: ClientProxy,
    @Inject(NOTIFICATION_DELIVERY_FAILED_CLIENT)
    private readonly failedClient: ClientProxy,
  ) {}

  // Point d'entrée utilisé par le dispatcher : premier essai (attempts: 0).
  async publish(job: Omit<NotificationDeliveryJob, 'attempts'>): Promise<void> {
    await this.publishJob({ ...job, attempts: 0 });
  }

  // Utilisé aussi par le consumer pour republier un job après un échec
  // (avec `attempts` incrémenté).
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

  // Dernier recours après épuisement des tentatives : le job part dans une
  // queue séparée dédiée aux échecs définitifs, pour rester visible et
  // inspectable (RabbitMQ management UI, ou le consumer de logs dédié) au
  // lieu d'être perdu silencieusement.
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
