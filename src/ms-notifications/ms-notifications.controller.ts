import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { NotificationDispatcherService } from './ms-notifications-dispatcher.service';
import { USER_CREATED_PATTERN } from './dto/user-created.event';
import type { UserCreatedEvent } from './dto/user-created.event';
import { USER_DELETED_PATTERN } from './dto/user-deleted.event';
import type { UserDeletedEvent } from './dto/user-deleted.event';

@Controller()
export class NotificationsController {
  private readonly logger = new Logger(NotificationsController.name);

  constructor(private readonly dispatcher: NotificationDispatcherService) {}

  @EventPattern(USER_CREATED_PATTERN)
  // Pas de @Ctx ici : ce handler ne fait pas d'ack manuel, contrairement a
  // NotificationDeliveryConsumer. Injecter un contexte inutilise masquait une
  // difference reelle entre les deux consommateurs.
  async handleUserCreated(@Payload() data: UserCreatedEvent): Promise<void> {
    const userId = data?.user_id ?? data?.googleId;
    const email = data?.email;

    this.logger.log(
      `Event ${USER_CREATED_PATTERN} reçu (user_id=${userId ?? 'inconnu'}, email=${
        email ?? 'absent'
      }).`,
    );

    if (!userId || !email) {
      this.logger.warn(
        `Event ${USER_CREATED_PATTERN} ignoré : user_id et/ou email manquant dans le payload.`,
      );
      return;
    }

    await this.dispatchEmailNotification({
      pattern: USER_CREATED_PATTERN,
      userId,
      email,
      content: this.buildWelcomeContent(data),
      type: this.typeFromTemplate(data?.template, 'WELCOME'),
      triggeredBy: 'ms-user',
    });
  }

  @EventPattern(USER_DELETED_PATTERN)
  async handleUserDeleted(@Payload() data: UserDeletedEvent): Promise<void> {
    const userId = data?.user_id ?? data?.googleId;
    const email = data?.email;

    this.logger.log(
      `Event ${USER_DELETED_PATTERN} reçu (user_id=${userId ?? 'inconnu'}, email=${
        email ?? 'absent'
      }).`,
    );

    if (!userId || !email) {
      this.logger.warn(
        `Event ${USER_DELETED_PATTERN} ignoré : user_id et/ou email manquant dans le payload.`,
      );
      return;
    }

    await this.dispatchEmailNotification({
      pattern: USER_DELETED_PATTERN,
      userId,
      email,
      content: 'Votre compte HubertApp a bien été supprimé.',
      type: this.typeFromTemplate(data?.template, 'ACCOUNT_DELETED'),
      triggeredBy: 'ms-user',
    });
  }

  private async dispatchEmailNotification(params: {
    pattern: string;
    userId: string;
    email: string;
    content: string;
    type: string;
    triggeredBy: string;
  }): Promise<void> {
    try {
      const notification = await this.dispatcher.dispatch({
        userId: params.userId,
        content: params.content,
        type: params.type,
        source: `rabbitmq:${params.pattern}`,
        triggeredBy: params.triggeredBy,
        channels: ['EMAIL'],
        recipientEmail: params.email,
      });

      this.logger.log(
        `Notification ${notification.id} créée et job EMAIL publié pour user_id=${params.userId}.`,
      );
    } catch (err) {
      this.logger.error(
        `Échec du traitement de ${params.pattern} pour user_id=${params.userId}.`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  private buildWelcomeContent(data: UserCreatedEvent): string {
    const nom = data?.pseudo?.trim() || data.email;
    return `Bienvenue ${nom} sur HubertApp !`;
  }

  private typeFromTemplate(
    template: string | undefined,
    defaultType: string,
  ): string {
    if (!template) return defaultType;
    return template.toUpperCase();
  }
}
