import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload, Ctx, RmqContext } from '@nestjs/microservices';
import { NotificationDispatcherService } from './ms-notifications-dispatcher.service';
import { USER_CREATED_PATTERN } from './dto/user-created.event';
import type { UserCreatedEvent } from './dto/user-created.event';

@Controller()
export class NotificationsController {
  private readonly logger = new Logger(NotificationsController.name);

  constructor(private readonly dispatcher: NotificationDispatcherService) {}

  @EventPattern(USER_CREATED_PATTERN)
  async handleUserCreated(
    @Payload() data: UserCreatedEvent,
    @Ctx() context: RmqContext,
  ): Promise<void> {
    
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

    try {
      const notification = await this.dispatcher.dispatch({
        userId,
        content: this.buildContent(data),
        type: this.typeFromTemplate(data?.template),
        source: `rabbitmq:${USER_CREATED_PATTERN}`,
        triggeredBy: 'ms-user',
        channels: ['EMAIL'],
       
        recipientEmail: email,
      });

      this.logger.log(
        `Notification ${notification.id} créée et job EMAIL publié pour user_id=${userId}.`,
      );
    } catch (err) {
      this.logger.error(
        `Échec du traitement de ${USER_CREATED_PATTERN} pour user_id=${userId}.`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  private buildContent(data: UserCreatedEvent): string {
    const nom = data?.pseudo?.trim() || data.email;
    return `Bienvenue ${nom} sur HubertApp !`;
  }

  private typeFromTemplate(template?: string): string {
    switch (template) {
      case 'welcome':
      case undefined:
        return 'WELCOME';
      default:
        return template.toUpperCase();
    }
  }
}