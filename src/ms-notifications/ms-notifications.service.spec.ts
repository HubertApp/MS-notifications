import { ForbiddenException, NotFoundException } from '@nestjs/common';
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
    save: jest.fn(function (this: Record<string, any>) {
      return Promise.resolve(this);
    }),
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
    // markAsRead relit le document puis appelle doc.save() : le mock doit donc
    // rendre un document mutable et persistant dans `stored`, sinon on ne peut
    // pas verifier l'effet de bord.
    findById: jest.fn((id: string) => ({
      exec: () => Promise.resolve(stored.find((d) => d._id === id) ?? null),
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
  // --- markAsRead : controle d'autorisation ---------------------------------
  // Cette methode decide qui a le droit de modifier la notification d'autrui.
  // Sans ces tests, inverser la condition ligne 62 du service laissait la suite
  // entierement verte.

  const seed = (id: string, userId: string) => {
    const doc = makeDoc({ _id: id, userId, content: 'x', type: 'MANUAL', source: 'test' });
    stored.push(doc);
    return doc;
  };

  it('shouldMarkAsReadWhenCallerOwnsTheNotification', async () => {
    const doc = seed('notif-1', 'user-A');

    const result = await service.markAsRead('notif-1', 'user-A', 'USER');

    expect(result.isRead).toBe(true);
    expect(doc.isRead).toBe(true);
    expect(doc.save).toHaveBeenCalledTimes(1);
  });

  it('shouldRefuseToMarkAsReadANotificationOwnedByAnotherUser', async () => {
    const doc = seed('notif-2', 'user-A');

    await expect(service.markAsRead('notif-2', 'user-B', 'USER')).rejects.toThrow(
      ForbiddenException,
    );

    // L'effet de bord ne doit pas avoir eu lieu non plus.
    expect(doc.isRead).toBe(false);
    expect(doc.save).not.toHaveBeenCalled();
  });

  it('shouldAllowAServiceCallerToMarkAnyNotificationAsRead', async () => {
    const doc = seed('notif-3', 'user-A');

    const result = await service.markAsRead('notif-3', 'ms-notifications', 'SERVICE');

    expect(result.isRead).toBe(true);
    expect(doc.save).toHaveBeenCalledTimes(1);
  });

  it('shouldThrowNotFoundWhenTheNotificationDoesNotExist', async () => {
    await expect(service.markAsRead('inconnue', 'user-A', 'USER')).rejects.toThrow(
      NotFoundException,
    );
  });
});
