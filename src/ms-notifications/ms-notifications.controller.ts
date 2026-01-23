import { Controller } from '@nestjs/common';
import { EventPattern, Payload, Ctx, RmqContext } from '@nestjs/microservices';
import { NotificationsService } from './ms-notifications.service';

@Controller()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @EventPattern('user_created')
  handleUserCreated(@Payload() data: any, @Ctx() context: RmqContext) {
    console.log(`⚡️ Event Reçu via RabbitMQ :`, data);
    
    // Exemple : Créer la notif
    if (data.user_id && data.email) {
        this.notificationsService.create(data.user_id, `Bienvenue ${data.email} !`);
    }
  }
}