import { Module } from '@nestjs/common';
import { NotificationsService } from './ms-notifications.service';
import { NotificationsResolver, UsersResolver } from './ms-notifications.resolver';
import { NotificationsController } from './ms-notifications.controller';

@Module({
  controllers: [NotificationsController],
  // "providers" = Les classes qui contiennent de la logique ou des fonctions
  providers: [
    NotificationsService,     // Le "cerveau" (stocke les données dans le tableau)
    NotificationsResolver,    // Le "guichetier" (répond aux mutations createNotification)
    UsersResolver             // L'extension (ajoute le champ notifications au User)
  ],
  
  // "exports" = Si un autre module avait besoin d'utiliser le Service, on le mettrait ici.
  exports: [NotificationsService], 
})
export class NotificationsModule {}