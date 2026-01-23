// src/notifications/notifications.service.ts
import { Injectable } from '@nestjs/common';
import { Notification } from './entities/notification.entity';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class NotificationsService {
  
  private readonly notifications: Notification[] = [];

  create(userId: string, content: string): Notification {
    const newNotif: Notification = {
      id: uuidv4(),
      userId,
      content,
      isRead: false,
      createdAt: new Date().toISOString(),
    };
    
    this.notifications.push(newNotif);
    return newNotif;
  }

  findAll(): Notification[] {
    return this.notifications;
  }

  findForUser(userId: string): Notification[] {
    return this.notifications.filter(n => n.userId === userId);
  }
}