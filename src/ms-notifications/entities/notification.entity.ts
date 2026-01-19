// src/notifications/entities/notification.entity.ts

export class Notification {
  id: string;       // L'identifiant unique
  userId: string;   // À qui appartient la notif
  content: string;  // Le message
  isRead: boolean;  // Lue ou pas lue
  createdAt: string; // Date de création
}