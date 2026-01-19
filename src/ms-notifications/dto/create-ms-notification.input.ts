import { InputType, Field } from '@nestjs/graphql';

@InputType()
export class CreateMsNotificationInput {
  @Field()
  channel: 'email' | 'sms' | 'push';

  @Field()
  to: string;

  @Field()
  message: string;
}
