import { Injectable, Logger } from '@nestjs/common';
import { Notification } from '../entities/notification.entity';
import { NotificationChannel } from './notification-channel.interface';

// La persistance est déjà la livraison in-app, voir ARCHITECTURE.md §3.
@Injectable()
export class InAppNotificationChannel implements NotificationChannel {
  readonly type = 'IN_APP';
  private readonly logger = new Logger(InAppNotificationChannel.name);

  supports(): boolean {
    return true;
  }

  // Pas d'`async` : il n'y a rien a attendre, la persistance EST la livraison
  // pour ce canal. On renvoie une promesse resolue pour respecter le contrat.
  send(notification: Notification): Promise<void> {
    this.logger.debug(
      `Notification ${notification.id} déjà disponible in-app pour user_id=${notification.userId}.`,
    );
    return Promise.resolve();
  }
}
