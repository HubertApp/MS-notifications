import { Injectable, Logger } from '@nestjs/common';
import { Notification } from '../entities/notification.entity';
import {
  NotificationChannel,
  NotificationRecipient,
} from './notification-channel.interface';

// La persistance est déjà la livraison in-app, voir ARCHITECTURE.md §3.
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
