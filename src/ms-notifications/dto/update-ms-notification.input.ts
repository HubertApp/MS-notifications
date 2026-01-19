import { CreateMsNotificationInput } from './create-ms-notification.input';
import { PartialType } from '@nestjs/mapped-types';

export class UpdateMsNotificationInput extends PartialType(CreateMsNotificationInput) {
  id: number;
}
