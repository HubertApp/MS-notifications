import { Injectable, Logger } from '@nestjs/common';
import { Notification } from '../entities/notification.entity';
import {
  NotificationChannel,
  NotificationRecipient,
} from './notification-channel.interface';

// Canal "in-app" : en réalité il n'y a rien à envoyer, la persistance en base
// (NotificationsService.create, appelée AVANT le dispatch des canaux) EST la
// livraison in-app — c'est elle que getAllNotifications consulte. Ce canal
// existe surtout pour que "IN_APP" soit un choix explicite et symétrique aux
// autres dans la liste `channels`, plutôt qu'un cas spécial caché.
@Injectable()
export class InAppNotificationChannel implements NotificationChannel {
  readonly type = 'IN_APP';
  private readonly logger = new Logger(InAppNotificationChannel.name);

  supports(): boolean {
    return true;
  }

  async send(notification: Notification): Promise<void> {
    this.logger.debug(
      `Notification ${notification.id} déjà disponible in-app pour user_id=${notification.userId}.`,
    );
  }
}
