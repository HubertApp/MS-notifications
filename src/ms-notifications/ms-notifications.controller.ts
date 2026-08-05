import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload, Ctx, RmqContext } from '@nestjs/microservices';
import { NotificationDispatcherService } from './ms-notifications-dispatcher.service';

@Controller()
export class NotificationsController {
  private readonly logger = new Logger(NotificationsController.name);

  constructor(private readonly dispatcher: NotificationDispatcherService) {}

  @EventPattern('user_created')
  handleUserCreated(@Payload() data: any, @Ctx() context: RmqContext) {
    // On log juste de quoi tracer l'événement sans exposer de données personnelles.
    this.logger.log(`Event user_created reçu pour user_id=${data?.user_id ?? 'inconnu'}`);

    if (data.user_id && data.email) {
        // Persistée in-app + envoyée par e-mail : l'adresse est déjà dans le
        // payload de l'événement, pas besoin d'aller la rechercher ailleurs.
        this.dispatcher.dispatch({
          userId: data.user_id,
          content: `Bienvenue ${data.email} !`,
          type: 'WELCOME',
          source: 'rabbitmq:user_created',
          triggeredBy: 'system',
          channels: ['EMAIL'],
          recipientEmail: data.email,
        });
    }
  }
}