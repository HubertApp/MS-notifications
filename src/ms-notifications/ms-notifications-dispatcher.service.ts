import { Injectable, Logger } from '@nestjs/common';
import {
  CreateNotificationParams,
  NotificationsService,
} from './ms-notifications.service';
import { Notification } from './entities/notification.entity';
import { NotificationDeliveryPublisher } from './notification-delivery.publisher';

export interface DispatchNotificationParams extends CreateNotificationParams {
  channels?: string[];
  // Jamais exposé côté GraphQL, voir ARCHITECTURE.md §4.
  recipientEmail?: string;
  recipientDisabledChannels?: string[];
}

// Persiste puis publie un job par canal (voir ARCHITECTURE.md §5).
@Injectable()
export class NotificationDispatcherService {
  private readonly logger = new Logger(NotificationDispatcherService.name);

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly deliveryPublisher: NotificationDeliveryPublisher,
  ) {}

  async dispatch(params: DispatchNotificationParams): Promise<Notification> {
    const {
      channels: requestedTypes = [],
      recipientEmail,
      recipientDisabledChannels,
      ...createParams
    } = params;

    const notification = await this.notificationsService.create(createParams);

    for (const channelType of requestedTypes) {
      if (channelType === 'IN_APP') continue;

      await this.deliveryPublisher.publish({
        notificationId: notification.id,
        userId: params.userId,
        content: notification.content,
        type: notification.type,
        channelType,
        email: recipientEmail,
        disabledChannels: recipientDisabledChannels ?? [],
      });
    }

    return notification;
  }
}
