import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type NotificationDocument = HydratedDocument<NotificationMongooseSchema>;

@Schema()
export class NotificationMongooseSchema {
  // Destinataire de la notification.
  @Prop({ type: String, required: true, index: true })
  userId: string;

  @Prop({ type: String, required: true })
  content: string;

  // Catégorie de la notification (ex: "WELCOME", "SYSTEM", "MANUAL"...).
  @Prop({ type: String, required: true })
  type: string;

  // Provenance technique : d'où vient l'événement qui a créé la notif
  // (ex: "rabbitmq:user_created", "graphql:createNotification").
  @Prop({ type: String, required: true })
  source: string;

  // Qui/quoi a déclenché la notification : un userId, "system", ou le nom
  // d'un service appelant. Optionnel car pas toujours identifiable.
  @Prop({ type: String, required: false })
  triggeredBy?: string;

  @Prop({ type: Boolean, default: false })
  isRead: boolean;

  @Prop({ type: Date, default: () => new Date() })
  createdAt: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(
  NotificationMongooseSchema,
);
