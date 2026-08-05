// Tests d'intégration : contrairement aux tests unitaires (*.spec.ts dans
// src/, tout mocké), on fait tourner ici la vraie chaîne NestJS — vrai
// module Mongoose, vrai schéma, vrai service, vrai dispatcher, vrai
// consumer de livraison, vrais canaux — contre une vraie base MongoDB
// (éphémère, en mémoire via mongodb-memory-server, donc pas besoin d'un
// Mongo externe pour lancer ces tests).
//
// Trois frontières restent doublées, car véritablement externes au service :
// le broker RabbitMQ réel (on simule sa queue en capturant ce qui est
// "emit" puis en le rejouant directement sur le consumer — pas de vrai
// AMQP nécessaire pour ces tests), l'envoi SMTP réel (MailProvider), et
// l'appel HTTP vers MS-User (UserLookupService).
import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { RmqContext } from '@nestjs/microservices';
import { Test, TestingModule } from '@nestjs/testing';
import { MongooseModule } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { of } from 'rxjs';
import { NotificationsService } from '../../src/ms-notifications/ms-notifications.service';
import { NotificationDispatcherService } from '../../src/ms-notifications/ms-notifications-dispatcher.service';
import { NotificationDeliveryPublisher, NOTIFICATION_DELIVERY_CLIENT, NOTIFICATION_DELIVERY_FAILED_CLIENT, NotificationDeliveryJob } from '../../src/ms-notifications/notification-delivery.publisher';
import { NotificationDeliveryConsumer } from '../../src/ms-notifications/notification-delivery.consumer';
import { NotificationsResolver, UsersResolver } from '../../src/ms-notifications/ms-notifications.resolver';
import {
  NotificationMongooseSchema,
  NotificationSchema,
} from '../../src/ms-notifications/schema/notification.schema';
import {
  NOTIFICATION_CHANNELS,
  NotificationChannel,
} from '../../src/ms-notifications/channels/notification-channel.interface';
import { InAppNotificationChannel } from '../../src/ms-notifications/channels/in-app-notification.channel';
import { EmailNotificationChannel } from '../../src/ms-notifications/channels/email-notification.channel';
import { MAIL_PROVIDER, MailMessage, MailProvider } from '../../src/mail/mail-provider.interface';
import { UserLookupService } from '../../src/ms-notifications/user-lookup.service';
import { FederatedAuthGuard, AuthenticatedUser } from '../../src/common/guards/federated-auth.guard';

// Simule le contexte GraphQL que FederatedAuthGuard extrait via
// GqlExecutionContext.create(context).getContext() — celui-ci appelle
// context.getArgs() puis prend l'index 2, le 3e argument standard d'un
// resolver GraphQL (parent, args, context, info).
function mockGqlExecutionContext(headers: Record<string, string>): ExecutionContext {
  const req = { headers };
  return {
    getArgs: () => [undefined, undefined, { req }, undefined],
    getClass: () => class {},
    getHandler: () => () => {},
    getType: () => 'graphql',
  } as unknown as ExecutionContext;
}

function mockRmqContext(): { context: RmqContext; ack: jest.Mock } {
  const ack = jest.fn();
  const context = {
    getChannelRef: () => ({ ack }),
    getMessage: () => ({}),
  } as unknown as RmqContext;
  return { context, ack };
}

class FakeMailProvider implements MailProvider {
  public sent: MailMessage[] = [];
  async send(message: MailMessage): Promise<void> {
    this.sent.push(message);
  }
}

describe('MS-notifications (intégration)', () => {
  let mongod: MongoMemoryServer;
  let moduleRef: TestingModule;
  let notificationsService: NotificationsService;
  let dispatcher: NotificationDispatcherService;
  let deliveryConsumer: NotificationDeliveryConsumer;
  let resolver: NotificationsResolver;
  let usersResolver: UsersResolver;
  let fakeMailProvider: FakeMailProvider;
  let userLookupStub: { getEmailForUser: jest.Mock };
  let guard: FederatedAuthGuard;
  let emittedJobs: { pattern: string; data: NotificationDeliveryJob }[];

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();

    fakeMailProvider = new FakeMailProvider();
    userLookupStub = { getEmailForUser: jest.fn().mockResolvedValue('user@example.com') };
    emittedJobs = [];

    // Double du ClientProxy RabbitMQ : au lieu d'un vrai broker, on capture
    // simplement ce qui serait publié. Les tests "producteur → consommateur"
    // rejouent ensuite manuellement ce job capturé sur le vrai consumer.
    const fakeDeliveryClient = {
      emit: jest.fn((pattern: string, data: NotificationDeliveryJob) => {
        emittedJobs.push({ pattern, data });
        return of(undefined);
      }),
    };
    const fakeFailedClient = {
      emit: jest.fn(() => of(undefined)),
    };

    moduleRef = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongod.getUri()),
        MongooseModule.forFeature([
          { name: NotificationMongooseSchema.name, schema: NotificationSchema },
        ]),
      ],
      providers: [
        NotificationsService,
        NotificationDispatcherService,
        NotificationDeliveryPublisher,
        NotificationDeliveryConsumer,
        NotificationsResolver,
        UsersResolver,
        FederatedAuthGuard,
        { provide: NOTIFICATION_DELIVERY_CLIENT, useValue: fakeDeliveryClient },
        { provide: NOTIFICATION_DELIVERY_FAILED_CLIENT, useValue: fakeFailedClient },
        { provide: MAIL_PROVIDER, useValue: fakeMailProvider },
        { provide: UserLookupService, useValue: userLookupStub },
        InAppNotificationChannel,
        EmailNotificationChannel,
        {
          provide: NOTIFICATION_CHANNELS,
          useFactory: (
            inApp: InAppNotificationChannel,
            email: EmailNotificationChannel,
          ): NotificationChannel[] => [inApp, email],
          inject: [InAppNotificationChannel, EmailNotificationChannel],
        },
      ],
    }).compile();

    notificationsService = moduleRef.get(NotificationsService);
    dispatcher = moduleRef.get(NotificationDispatcherService);
    deliveryConsumer = moduleRef.get(NotificationDeliveryConsumer);
    resolver = moduleRef.get(NotificationsResolver);
    usersResolver = moduleRef.get(UsersResolver);
    guard = moduleRef.get(FederatedAuthGuard);
  });

  afterAll(async () => {
    await moduleRef.close();
    await mongod.stop();
  });

  describe('persistance réelle (Mongo en mémoire)', () => {
    it('shouldPersistAndRetrieveANotificationEndToEnd', async () => {
      const created = await notificationsService.create({
        userId: 'user-A',
        content: 'Contenu réel',
        type: 'MANUAL',
        source: 'integration-test',
      });

      expect(created.id).toBeDefined();
      expect(created.isRead).toBe(false);
      expect(created.createdAt).toBeDefined();

      const found = await notificationsService.findForUser('user-A');
      expect(found.some((n) => n.id === created.id)).toBe(true);
    });

    it('shouldNeverLeakOneUsersNotificationsToAnother', async () => {
      await notificationsService.create({
        userId: 'user-B',
        content: 'Pour B',
        type: 'MANUAL',
        source: 'integration-test',
      });
      await notificationsService.create({
        userId: 'user-C',
        content: 'Pour C',
        type: 'MANUAL',
        source: 'integration-test',
      });

      const forB = await notificationsService.findForUser('user-B');
      expect(forB.every((n) => n.userId === 'user-B')).toBe(true);

      const forC = await notificationsService.findForUser('user-C');
      expect(forC.every((n) => n.userId === 'user-C')).toBe(true);
    });

    it('shouldExposeNotificationsThroughTheUserResolveField', async () => {
      await notificationsService.create({
        userId: 'user-D',
        content: 'Via ResolveField',
        type: 'MANUAL',
        source: 'integration-test',
      });

      const result = await usersResolver.getNotifications({ id: 'user-D' });
      expect(result.length).toBeGreaterThan(0);
      expect(result.every((n) => n.userId === 'user-D')).toBe(true);
    });
  });

  describe('chaîne complète dispatcher → queue → consumer → vrais canaux', () => {
    it('shouldPersistPublishAJobThenDeliverItThroughTheRealConsumerAndChannel', async () => {
      const before = fakeMailProvider.sent.length;
      emittedJobs = [];

      const notification = await dispatcher.dispatch({
        userId: 'user-E',
        content: 'Bienvenue user-E !',
        type: 'WELCOME',
        source: 'integration-test',
        channels: ['EMAIL'],
      });

      // 1) Le dispatcher a bien persisté ET publié un job (pas encore livré).
      expect(fakeMailProvider.sent.length).toBe(before);
      expect(emittedJobs).toHaveLength(1);
      expect(emittedJobs[0].data).toMatchObject({
        notificationId: notification.id,
        userId: 'user-E',
        channelType: 'EMAIL',
        attempts: 0,
      });

      // 2) On rejoue ce job exact sur le vrai consumer (comme le ferait
      // RabbitMQ en le délivrant) : c'est ici que la stratégie EMAIL et le
      // MailProvider (doublé) sont réellement exécutés.
      const { context, ack } = mockRmqContext();
      await deliveryConsumer.handleDelivery(emittedJobs[0].data, context);

      expect(userLookupStub.getEmailForUser).toHaveBeenCalledWith('user-E');
      expect(fakeMailProvider.sent.length).toBe(before + 1);
      expect(fakeMailProvider.sent[fakeMailProvider.sent.length - 1]).toMatchObject({
        to: 'user@example.com',
        text: 'Bienvenue user-E !',
      });
      expect(ack).toHaveBeenCalledTimes(1);

      const found = await notificationsService.findForUser('user-E');
      expect(found.length).toBeGreaterThan(0);
    });

    it('shouldPersistEvenWhenNoChannelIsRequested', async () => {
      emittedJobs = [];

      const notification = await dispatcher.dispatch({
        userId: 'user-F',
        content: 'Notification purement in-app',
        type: 'MANUAL',
        source: 'integration-test',
      });

      expect(notification.id).toBeDefined();
      expect(emittedJobs).toHaveLength(0);
    });
  });

  describe('FederatedAuthGuard (vraie logique, contexte GraphQL simulé)', () => {
    it('shouldRejectWhenNoUserIdHeaderIsPresent', () => {
      const context = mockGqlExecutionContext({});
      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it('shouldRejectWhenAuthStateIsExplicitlyInvalid', () => {
      const context = mockGqlExecutionContext({
        'x-user-id': 'user-123',
        'x-auth-state': 'INVALID',
      });
      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it('shouldAllowAndPopulateReqUserWhenHeadersAreValid', () => {
      const req: any = { headers: { 'x-user-id': 'user-123', 'x-user-role': 'USER' } };
      const context = {
        getArgs: () => [undefined, undefined, { req }, undefined],
        getClass: () => class {},
        getHandler: () => () => {},
        getType: () => 'graphql',
      } as unknown as ExecutionContext;

      const result = guard.canActivate(context);

      expect(result).toBe(true);
      expect(req.user).toEqual({ userId: 'user-123', role: 'USER', email: undefined });
    });
  });

  describe('resolver createNotification : autorisation + persistance réelles', () => {
    const asUser = (userId: string, role = 'USER'): AuthenticatedUser => ({ userId, role });

    it('shouldPersistWhenAUserCreatesForThemselves', async () => {
      const result = await resolver.create('user-G', 'Pour moi-même', undefined, asUser('user-G'));

      expect(result.id).toBeDefined();
      const found = await notificationsService.findForUser('user-G');
      expect(found.some((n) => n.id === result.id)).toBe(true);
    });

    it('shouldThrowAndPersistNothingWhenAUserTargetsSomeoneElse', async () => {
      const before = await notificationsService.findForUser('user-H');

      expect(() =>
        resolver.create('user-H', 'Pas pour moi', undefined, asUser('user-intrus')),
      ).toThrow(ForbiddenException);

      const after = await notificationsService.findForUser('user-H');
      expect(after.length).toBe(before.length);
    });

    it('shouldAllowAServiceCallerToCreateForAnyoneAndPersistIt', async () => {
      const result = await resolver.create(
        'user-I',
        'Notification système',
        undefined,
        asUser('ms-admin', 'SERVICE'),
      );

      expect(result.id).toBeDefined();
      const found = await notificationsService.findForUser('user-I');
      expect(found.some((n) => n.id === result.id && n.type === 'SERVICE')).toBe(true);
    });
  });
});
