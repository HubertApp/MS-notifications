import { Inject, Injectable, Logger } from '@nestjs/common';
import { Notification } from '../entities/notification.entity';
import { MAIL_PROVIDER } from '../../mail/mail-provider.interface';
import type { MailProvider } from '../../mail/mail-provider.interface';
import type {
  NotificationChannel,
  NotificationRecipient,
} from './notification-channel.interface';

@Injectable()
export class EmailNotificationChannel implements NotificationChannel {
  readonly type = 'EMAIL';
  private readonly logger = new Logger(EmailNotificationChannel.name);

  constructor(@Inject(MAIL_PROVIDER) private readonly mailProvider: MailProvider) {}

  supports(recipient: NotificationRecipient): boolean {
    return Boolean(recipient.email);
  }

  async send(notification: Notification, recipient: NotificationRecipient): Promise<void> {
    if (!recipient.email) {
      this.logger.warn(
        `Canal EMAIL demandé sans adresse pour user_id=${recipient.userId}, ignoré.`,
      );
      return;
    }

    await this.mailProvider.send({
      to: recipient.email,
      subject: this.subjectFor(notification.type),
      text: notification.content,
    });
  }

  private subjectFor(type: string): string {
    switch (type) {
      case 'WELCOME':
        return 'Bienvenue sur HubertApp';
      default:
        return 'Nouvelle notification HubertApp';
    }
  }
}
