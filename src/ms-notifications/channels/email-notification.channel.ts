import { Inject, Injectable, Logger } from '@nestjs/common';
import { Notification } from '../entities/notification.entity';
import { MAIL_PROVIDER } from '../../mail/mail-provider.interface';
import type { MailProvider } from '../../mail/mail-provider.interface';
import { getEmailTemplate, renderEmailLayout } from '../../mail/templates';
import type {
  NotificationChannel,
  NotificationRecipient,
} from './notification-channel.interface';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

@Injectable()
export class EmailNotificationChannel implements NotificationChannel {
  readonly type = 'EMAIL';
  private readonly logger = new Logger(EmailNotificationChannel.name);

  constructor(
    @Inject(MAIL_PROVIDER) private readonly mailProvider: MailProvider,
  ) {}

  supports(recipient: NotificationRecipient): boolean {
    return Boolean(recipient.email);
  }

  async send(
    notification: Notification,
    recipient: NotificationRecipient,
  ): Promise<void> {
    if (!recipient.email) {
      this.logger.warn(
        `Canal EMAIL demandé sans adresse pour user_id=${recipient.userId}, ignoré.`,
      );
      return;
    }

    const template = getEmailTemplate(notification.type);
    const frontUrl = process.env.FRONT_PUBLIC_URL || 'http://localhost:8080';
    const unsubscribeUrl = `${frontUrl}/desabonnement?userId=${encodeURIComponent(recipient.userId)}`;
    const content = template.build({
      notification,
      recipient,
      frontUrl,
      unsubscribeUrl,
      escapeHtml,
    });

    await this.mailProvider.send({
      to: recipient.email,
      subject: template.subject,
      text: notification.content,
      html: renderEmailLayout(content),
    });
  }
}
