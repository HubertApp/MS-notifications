// Producteur (dispatch) et consommateur (livraison réelle) mesurés
// séparément, voir ARCHITECTURE.md. Tout est mocké côté I/O pour rester
// déterministe en CI ; pour un test de charge HTTP réel, voir scripts/load-test.mjs.
import { Test, TestingModule } from '@nestjs/testing';
import { RmqContext } from '@nestjs/microservices';
import { NotificationDispatcherService } from '../../src/ms-notifications/ms-notifications-dispatcher.service';
import { NotificationsService } from '../../src/ms-notifications/ms-notifications.service';
import { NotificationDeliveryPublisher } from '../../src/ms-notifications/notification-delivery.publisher';
import { NotificationDeliveryConsumer } from '../../src/ms-notifications/notification-delivery.consumer';
import { NotificationChannel } from '../../src/ms-notifications/channels/notification-channel.interface';
import { EmailNotificationChannel } from '../../src/ms-notifications/channels/email-notification.channel';
import { Notification } from '../../src/ms-notifications/entities/notification.entity';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const SIMULATED_DB_LATENCY_MS = 5;
const SIMULATED_BROKER_PUBLISH_LATENCY_MS = 5;
const SIMULATED_SMTP_LATENCY_MS = 80;

function mockRmqContext(): RmqContext {
  return {
    getChannelRef: () => ({ ack: () => undefined }),
    getMessage: () => ({}),
  } as unknown as RmqContext;
}

describe('MS-notifications (performance)', () => {
  describe('débit du producteur (dispatch)', () => {
    let dispatcher: NotificationDispatcherService;

    beforeEach(async () => {
      let idCounter = 0;
      const mockNotificationsService = {
        create: jest.fn(async (params: any) => {
          await delay(SIMULATED_DB_LATENCY_MS);
          idCounter += 1;
          return {
            id: `notif-${idCounter}`,
            isRead: false,
            createdAt: new Date().toISOString(),
            ...params,
          };
        }),
      };
      const mockPublisher = {
        publish: jest.fn(async () => {
          await delay(SIMULATED_BROKER_PUBLISH_LATENCY_MS);
        }),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          NotificationDispatcherService,
          { provide: NotificationsService, useValue: mockNotificationsService },
          { provide: NotificationDeliveryPublisher, useValue: mockPublisher },
        ],
      }).compile();

      dispatcher = module.get(NotificationDispatcherService);
    });

    it('shouldSustainHighThroughputRegardlessOfHowSlowActualDeliveryWouldBe', async () => {
      const CONCURRENCY = 300;

      const start = Date.now();
      await Promise.all(
        Array.from({ length: CONCURRENCY }, (_, i) =>
          dispatcher.dispatch({
            userId: `user-${i}`,
            content: 'Notification en charge',
            type: 'WELCOME',
            source: 'perf-test',
            channels: ['EMAIL'],
          }),
        ),
      );
      const elapsedMs = Date.now() - start;

      const maxAcceptableMs =
        CONCURRENCY *
        (SIMULATED_DB_LATENCY_MS + SIMULATED_BROKER_PUBLISH_LATENCY_MS) *
        10;
      expect(elapsedMs).toBeLessThan(maxAcceptableMs);
      expect(elapsedMs).toBeLessThan(CONCURRENCY * SIMULATED_SMTP_LATENCY_MS);
    }, 20000);

    it('shouldSustainAMinimumThroughputOfPersistenceOnlyDispatches', async () => {
      const CONCURRENCY = 500;

      const start = Date.now();
      await Promise.all(
        Array.from({ length: CONCURRENCY }, (_, i) =>
          dispatcher.dispatch({
            userId: `user-${i}`,
            content: 'Notification in-app uniquement',
            type: 'MANUAL',
            source: 'perf-test',
          }),
        ),
      );
      const elapsedMs = Date.now() - start;
      const opsPerSecond = (CONCURRENCY / elapsedMs) * 1000;

      expect(opsPerSecond).toBeGreaterThan(200);
    }, 20000);
  });

  describe('débit du consommateur (livraison réelle des jobs)', () => {
    let consumer: NotificationDeliveryConsumer;
    let sendCallCount: number;

    beforeEach(() => {
      sendCallCount = 0;

      const mockUserLookup = {
        getRecipientInfo: jest.fn().mockResolvedValue({
          email: 'user@example.com',
          disabledChannels: [],
        }),
      };
      const mockPublisher = { publishJob: jest.fn(), publishFailed: jest.fn() };
      const emailChannel: NotificationChannel = {
        type: 'EMAIL',
        supports: () => true,
        send: jest.fn(async () => {
          sendCallCount += 1;
          await delay(SIMULATED_SMTP_LATENCY_MS);
        }),
      };

      consumer = new NotificationDeliveryConsumer(
        mockUserLookup as any,
        mockPublisher as any,
        [emailChannel],
      );
    });

    it('shouldProcessABatchOfJobsWithinTheExpectedTimeBudget', async () => {
      const JOB_COUNT = 20;

      const start = Date.now();
      for (let i = 0; i < JOB_COUNT; i++) {
        await consumer.handleDelivery(
          {
            notificationId: `notif-${i}`,
            userId: `user-${i}`,
            content: 'Bienvenue',
            type: 'WELCOME',
            channelType: 'EMAIL',
            attempts: 0,
          },
          mockRmqContext(),
        );
      }
      const elapsedMs = Date.now() - start;

      expect(sendCallCount).toBe(JOB_COUNT);
      expect(elapsedMs).toBeLessThan(JOB_COUNT * SIMULATED_SMTP_LATENCY_MS * 3);
    }, 20000);
  });

  describe('le producteur reste rapide même si le consommateur est bloqué', () => {
    it('shouldKeepDispatchingFastWhileTheConsumerIsStuckOnASlowJob', async () => {
      const mockNotificationsService = {
        create: jest.fn(async (params: any) => ({
          id: 'notif-x',
          isRead: false,
          createdAt: new Date().toISOString(),
          ...params,
        })),
      };
      const mockPublisher = { publish: jest.fn().mockResolvedValue(undefined) };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          NotificationDispatcherService,
          { provide: NotificationsService, useValue: mockNotificationsService },
          { provide: NotificationDeliveryPublisher, useValue: mockPublisher },
        ],
      }).compile();
      const dispatcher = module.get(NotificationDispatcherService);

      const mockUserLookup = {
        getRecipientInfo: jest.fn().mockResolvedValue({
          email: 'user@example.com',
          disabledChannels: [],
        }),
      };
      const mockDeliveryPublisher = {
        publishJob: jest.fn(),
        publishFailed: jest.fn(),
      };
      const stuckChannel: NotificationChannel = {
        type: 'EMAIL',
        supports: () => true,
        send: async () => {
          await delay(2000);
        },
      };
      const consumer = new NotificationDeliveryConsumer(
        mockUserLookup as any,
        mockDeliveryPublisher as any,
        [stuckChannel],
      );
      const stuckJobPromise = consumer.handleDelivery(
        {
          notificationId: 'notif-stuck',
          userId: 'user-stuck',
          content: 'Coincé',
          type: 'WELCOME',
          channelType: 'EMAIL',
          attempts: 0,
        },
        mockRmqContext(),
      );

      const start = Date.now();
      await dispatcher.dispatch({
        userId: 'user-fast',
        content: 'Devrait être rapide',
        type: 'MANUAL',
        source: 'perf-test',
      });
      const elapsedMs = Date.now() - start;

      expect(elapsedMs).toBeLessThan(500);

      await stuckJobPromise;
    }, 10000);
  });

  describe('rendu des templates email sous charge (canal EMAIL réel)', () => {
    let channel: EmailNotificationChannel;
    let sentCount: number;

    const makeNotification = (type: string, i: number): Notification => ({
      id: `notif-${i}`,
      userId: `user-${i}`,
      content: 'Contenu de test',
      type,
      source: 'perf-test',
      isRead: false,
      createdAt: new Date().toISOString(),
    });

    beforeEach(() => {
      sentCount = 0;
      const mockMailProvider = {
        send: jest.fn(async () => {
          sentCount += 1;
          await delay(SIMULATED_SMTP_LATENCY_MS);
        }),
      };
      channel = new EmailNotificationChannel(mockMailProvider as any);
    });

    it('shouldRenderAndSendABatchOfAccountDeletedEmailsWithinBudget', async () => {
      const BATCH = 50;

      const start = Date.now();
      await Promise.all(
        Array.from({ length: BATCH }, (_, i) =>
          channel.send(makeNotification('ACCOUNT_DELETED', i), {
            userId: `user-${i}`,
            email: `user-${i}@example.com`,
          }),
        ),
      );
      const elapsedMs = Date.now() - start;

      expect(sentCount).toBe(BATCH);
      expect(elapsedMs).toBeLessThan(BATCH * SIMULATED_SMTP_LATENCY_MS);
    }, 10000);

    it('shouldNotBeMeaningfullySlowerThanTheWelcomeTemplateForTheSameBatchSize', async () => {
      const BATCH = 50;

      const welcomeStart = Date.now();
      await Promise.all(
        Array.from({ length: BATCH }, (_, i) =>
          channel.send(makeNotification('WELCOME', i), {
            userId: `user-${i}`,
            email: `user-${i}@example.com`,
          }),
        ),
      );
      const welcomeElapsedMs = Date.now() - welcomeStart;

      sentCount = 0;
      const deletedStart = Date.now();
      await Promise.all(
        Array.from({ length: BATCH }, (_, i) =>
          channel.send(makeNotification('ACCOUNT_DELETED', i), {
            userId: `user-${i}`,
            email: `user-${i}@example.com`,
          }),
        ),
      );
      const deletedElapsedMs = Date.now() - deletedStart;

      expect(deletedElapsedMs).toBeLessThan(welcomeElapsedMs * 2 + 50);
    }, 10000);
  });
});
