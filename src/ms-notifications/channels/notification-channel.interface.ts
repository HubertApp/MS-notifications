// Pattern Stratégie : chaque "canal" (in-app, e-mail, SMS, push...) implémente
// cette même interface. Le dispatcher (voir ms-notifications-dispatcher.service.ts)
// ne connaît que cette interface, jamais les implémentations concrètes — pour
// ajouter un nouveau canal, il suffit d'écrire une nouvelle classe et de la
// déclarer dans le module, sans toucher au dispatcher (principe ouvert/fermé).

import { Notification } from '../entities/notification.entity';

export interface NotificationRecipient {
  userId: string;
  email?: string;
  // Extensible plus tard : phoneNumber?, pushToken?, etc.
}

export interface NotificationChannel {
  /** Identifiant du canal, ex: "IN_APP", "EMAIL", "SMS". */
  readonly type: string;

  /** Le canal a-t-il ce qu'il faut pour livrer cette notif à ce destinataire ? */
  supports(recipient: NotificationRecipient): boolean;

  /** Livre effectivement la notification via ce canal. */
  send(notification: Notification, recipient: NotificationRecipient): Promise<void>;
}

// Token d'injection pour le tableau de stratégies (voir le provider factory
// dans ms-notifications.module.ts).
export const NOTIFICATION_CHANNELS = Symbol('NOTIFICATION_CHANNELS');
