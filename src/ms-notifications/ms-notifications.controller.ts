import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload, Ctx, RmqContext } from '@nestjs/microservices';
import { NotificationsService } from './ms-notifications.service';

@Controller()
export class NotificationsController {
  private readonly logger = new Logger(NotificationsController.name);

  constructor(private readonly notificationsService: NotificationsService) {}

  @EventPattern('user_created')
  handleUserCreated(@Payload() data: any, @Ctx() context: RmqContext) {
    // On log juste de quoi tracer l'événement sans exposer de données personnelles.
    this.logger.log(`Event user_created reçu pour user_id=${data?.user_id ?? 'inconnu'}`);

    if (data.user_id && data.email) {
        this.notificationsService.create({
          userId: data.user_id,
          content: `Bienvenue ${data.email} !`,
          type: 'WELCOME',
          source: 'rabbitmq:user_created',
          triggeredBy: 'system',
        });
    }
  }
}