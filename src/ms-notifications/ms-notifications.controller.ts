import { Controller } from '@nestjs/common';
import { EventPattern, Payload, Ctx, RmqContext } from '@nestjs/microservices';
import { NotificationsService } from './ms-notifications.service';

@Controller()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  // Dès qu'un message avec le motif "user_created" arrive, cette fonction se lance
  @EventPattern('user_created')
  handleUserCreated(@Payload() data: any, @Ctx() context: RmqContext) {
    console.log(`⚡️ Event Reçu via RabbitMQ :`, data);
    
    // Exemple : Créer la notif automatiquement
    if (data.userId && data.email) {
        this.notificationsService.create(data.userId, `Bienvenue ${data.email} !`);
    }
  }
}