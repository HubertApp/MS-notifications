import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotificationsService } from './ms-notifications.service';
import { NotificationMongooseSchema } from './schema/notification.schema';

describe('NotificationsService', () => {
  let service: NotificationsService;

  // Mock minimal du Model Mongoose : pas de vraie base de données dans ce test.
  const makeDoc = (data: Record<string, any>) => ({
    _id: data._id ?? 'mock-id',
    userId: data.userId,
    content: data.content,
    type: data.type,
    source: data.source,
    triggeredBy: data.triggeredBy,
    isRead: data.isRead ?? false,
    createdAt: data.createdAt ?? new Date(),
  });

  let stored: any[] = [];

  const mockModel = {
    create: jest.fn((data: any) => {
      const doc = makeDoc(data);
      stored.push(doc);
      return Promise.resolve(doc);
    }),
    find: jest.fn((query: { userId?: string }) => ({
      sort: () => ({
        exec: () =>
          Promise.resolve(
            stored.filter((d) => !query?.userId || d.userId === query.userId),
          ),
      }),
    })),
  };

  beforeEach(async () => {
    stored = [];
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: getModelToken(NotificationMongooseSchema.name),
          useValue: mockModel,
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  it('shouldCreateNotificationWithDefaultStatusAndMetadata', async () => {
    const result = await service.create({
      userId: 'user-123',
      content: 'Hello World',
      type: 'MANUAL',
      source: 'graphql:createNotification',
      triggeredBy: 'user-123',
    });

    expect(result).toBeDefined();
    expect(result.id).toBeDefined();
    expect(result.content).toBe('Hello World');
    expect(result.isRead).toBe(false);
    expect(result.type).toBe('MANUAL');
    expect(result.source).toBe('graphql:createNotification');

    const userNotifs = await service.findForUser('user-123');
    expect(userNotifs).toHaveLength(1);
  });

  it('shouldReturnOnlyNotificationsForSpecificUser', async () => {
    await service.create({ userId: 'user-A', content: 'Notif A1', type: 'MANUAL', source: 'test' });
    await service.create({ userId: 'user-B', content: 'Notif B1', type: 'MANUAL', source: 'test' });
    await service.create({ userId: 'user-A', content: 'Notif A2', type: 'MANUAL', source: 'test' });

    const userANotifications = await service.findForUser('user-A');

    expect(userANotifications).toHaveLength(2);
    const hasUserB = userANotifications.some((n) => n.userId === 'user-B');
    expect(hasUserB).toBe(false);
  });
});
