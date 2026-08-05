// src/ms-notifications/ms-notifications.service.ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  NotificationDocument,
  NotificationMongooseSchema,
} from './schema/notification.schema';
import { Notification } from './entities/notification.entity';

export interface CreateNotificationParams {
  userId: string;
  content: string;
  type: string;
  source: string;
  triggeredBy?: string;
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(NotificationMongooseSchema.name)
    private readonly notificationModel: Model<NotificationDocument>,
  ) {}

  async create(params: CreateNotificationParams): Promise<Notification> {
    const doc = await this.notificationModel.create({
      userId: params.userId,
      content: params.content,
      type: params.type,
      source: params.source,
      triggeredBy: params.triggeredBy,
      isRead: false,
      createdAt: new Date(),
    });
    return this.toEntity(doc);
  }

  // Seul findForUser() subsiste, toujours filtré par destinataire.
  async findForUser(userId: string): Promise<Notification[]> {
    const docs = await this.notificationModel
      .find({ userId })
      .sort({ createdAt: -1 })
      .exec();
    return docs.map((d) => this.toEntity(d));
  }

  private toEntity(doc: NotificationDocument): Notification {
    return {
      id: String(doc._id),
      userId: doc.userId,
      content: doc.content,
      type: doc.type,
      source: doc.source,
      triggeredBy: doc.triggeredBy,
      isRead: doc.isRead,
      createdAt: doc.createdAt.toISOString(),
    };
  }
}
