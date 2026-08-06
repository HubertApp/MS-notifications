// Pattern Stratégie pour les canaux de notification. Voir ARCHITECTURE.md §3.
import { Notification } from '../entities/notification.entity';

export interface NotificationRecipient {
  userId: string;
  email?: string;
}

export interface NotificationChannel {
  /** Identifiant du canal, ex: "IN_APP", "EMAIL", "SMS". */
  readonly type: string;

  /** Le canal a-t-il ce qu'il faut pour livrer cette notif à ce destinataire ? */
  supports(recipient: NotificationRecipient): boolean;

  /** Livre effectivement la notification via ce canal. */
  send(notification: Notification, recipient: NotificationRecipient): Promise<void>;
}

export const NOTIFICATION_CHANNELS = Symbol('NOTIFICATION_CHANNELS');
