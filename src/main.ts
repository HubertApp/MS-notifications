import { readFileSync } from 'fs';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { NOTIFICATIONS_QUEUE } from './ms-notifications/dto/user-created.event';

const RABBITMQ_URL =
  process.env.RABBITMQ_URL || 'amqps://user:password@rabbitmq:5671';

// CA interne, voir ARCHITECTURE.md §10.
const RABBITMQ_CA_PATH = process.env.RABBITMQ_CA_PATH || '/etc/tls/ca.pem';
const socketOptions = RABBITMQ_URL.startsWith('amqps://')
  ? { ca: [readFileSync(RABBITMQ_CA_PATH)] }
  : undefined;

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [RABBITMQ_URL],
      queue: NOTIFICATIONS_QUEUE,
      socketOptions,
      queueOptions: {
        durable: true,
      },
    },
  });

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [RABBITMQ_URL],
      queue: 'notification_delivery_queue',
      noAck: false,
      socketOptions,
      queueOptions: {
        durable: true,
      },
    },
  });

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [RABBITMQ_URL],
      queue: 'notification_delivery_failed_queue',
      socketOptions,
      queueOptions: {
        durable: true,
      },
    },
  });

  await app.startAllMicroservices();

  await app.listen(3008, '0.0.0.0');

  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();