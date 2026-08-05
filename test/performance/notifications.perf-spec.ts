// Tests de performance : avec la queue RabbitMQ de livraison, le chemin
// "producteur" (dispatch : persister + publier un job) et le chemin
// "consommateur" (traiter réellement un job : résoudre l'e-mail, envoyer via
// SMTP...) sont deux choses complètement découplées, reliées uniquement par
// la queue. On mesure donc les deux séparément :
//  1. Le débit du producteur (ce qui détermine la latence perçue par un
//     appelant GraphQL ou par l'event RabbitMQ user_created).
//  2. Le débit du consommateur (ce qui détermine la vitesse à laquelle la
//     "pile" de mails en attente se vide).
// Tout est mocké côté I/O (pas de vrai Mongo/RabbitMQ/SMTP) pour rester
// déterministe et rapide en CI. Pour un vrai test de charge HTTP contre une
// instance qui tourne, voir scripts/load-test.mjs.
import { Test, TestingModule } from '@nestjs/testing';
import { RmqContext } from '@nestjs/microservices';
import { NotificationDispatcherService } from '../../src/ms-notifications/ms-notifications-dispatcher.service';
import { NotificationsService } from '../../src/ms-notifications/ms-notifications.service';
import { NotificationDeliveryPublisher } from '../../src/ms-notifications/notification-delivery.publisher';
import { NotificationDeliveryConsumer } from '../../src/ms-notifications/notification-delivery.consumer';
import { UserLookupService } from '../../src/ms-notifications/user-lookup.service';
import { NotificationChannel } from '../../src/ms-notifications/channels/notification-channel.interface';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Simule une latence Mongo/RabbitMQ modeste (écriture réseau locale), très
// inférieure à un aller-retour SMTP réel.
const SIMULATED_DB_LATENCY_MS = 5;
const SIMULATED_BROKER_PUBLISH_LATENCY_MS = 5;
// Simule un SMTP réaliste (beaucoup de fournisseurs répondent en 50-300ms).
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
          return { id: `notif-${idCounter}`, isRead: false, createdAt: new Date().toISOString(), ...params };
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

      // Le producteur ne dépend que des latences DB + publish (toutes deux
      // rapides et parallélisables), jamais de la latence d'envoi réelle
      // (SMTP) qui n'intervient que côté consumer, ailleurs. Marge x10 pour
      // ne pas rendre le test flaky sur une machine chargée.
      const maxAcceptableMs =
        CONCURRENCY * (SIMULATED_DB_LATENCY_MS + SIMULATED_BROKER_PUBLISH_LATENCY_MS) * 10;
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
            // Pas de "channels" : que de la persistance, le cas le plus fréquent.
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

      const mockUserLookup = { getEmailForUser: jest.fn().mockResolvedValue('user@example.com') };
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
      // Le traitement est intentionnellement séquentiel (comme un vrai
      // consumer RabbitMQ à prefetch=1) : c'est ce compromis, documenté,
      // qui évite de bombarder un SMTP en parallèle sans limite.
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
      // Budget cohérent avec la latence SMTP simulée (marge x3).
      expect(elapsedMs).toBeLessThan(JOB_COUNT * SIMULATED_SMTP_LATENCY_MS * 3);
    }, 20000);
  });

  describe("le producteur reste rapide même si le consommateur est bloqué", () => {
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

      // Un "consumer" volontairement très lent (simule un SMTP quasi mort),
      // lancé en tâche de fond, PENDANT qu'on continue à dispatcher.
      const mockUserLookup = { getEmailForUser: jest.fn().mockResolvedValue('user@example.com') };
      const mockDeliveryPublisher = { publishJob: jest.fn(), publishFailed: jest.fn() };
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

      await stuckJobPromise; // nettoyage, pour ne pas laisser de timer en vol.
    }, 10000);
  });
});
