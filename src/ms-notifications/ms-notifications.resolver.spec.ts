import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { NotificationsResolver } from './ms-notifications.resolver';
import { NotificationsService } from './ms-notifications.service';
import { AuthenticatedUser } from '../common/guards/federated-auth.guard';

describe('NotificationsResolver', () => {
  let resolver: NotificationsResolver;
  let service: NotificationsService;

  const mockNotificationsService = {
    findForUser: jest.fn((userId: string) => [{ id: 'mock-notif', userId }]),
    create: jest.fn((params: any) => ({
      id: 'mock-id',
      ...params,
    })),
  };

  const asUser = (userId: string, role = 'USER'): AuthenticatedUser => ({
    userId,
    role,
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsResolver,
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
      ],
    }).compile();

    resolver = module.get<NotificationsResolver>(NotificationsResolver);
    service = module.get<NotificationsService>(NotificationsService);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });

  describe('findAll (getAllNotifications)', () => {
    it('shouldOnlyReturnNotificationsForTheAuthenticatedCaller', () => {
      const user = asUser('user-123');

      const result = resolver.findAll(user);

      expect(service.findForUser).toHaveBeenCalledWith('user-123');
      expect(result).toEqual([{ id: 'mock-notif', userId: 'user-123' }]);
    });
  });

  describe('create', () => {
    it('shouldAllowAUserToCreateANotificationForThemselves', () => {
      const user = asUser('user-123');

      const result = resolver.create('user-123', 'Test Content', user);

      expect(service.create).toHaveBeenCalledWith({
        userId: 'user-123',
        content: 'Test Content',
        type: 'MANUAL',
        source: 'graphql:createNotification',
        triggeredBy: 'user-123',
      });
      expect(result).toBeDefined();
    });

    it('shouldRejectAUserCreatingANotificationForSomeoneElse', () => {
      const user = asUser('user-123');

      expect(() => resolver.create('someone-else', 'Test Content', user)).toThrow(
        ForbiddenException,
      );
      expect(service.create).not.toHaveBeenCalled();
    });

    it('shouldAllowAServiceRoleToCreateANotificationForAnyone', () => {
      const serviceUser = asUser('ms-admin', 'SERVICE');

      const result = resolver.create('someone-else', 'Test Content', serviceUser);

      expect(service.create).toHaveBeenCalledWith({
        userId: 'someone-else',
        content: 'Test Content',
        type: 'SERVICE',
        source: 'graphql:createNotification',
        triggeredBy: 'ms-admin',
      });
      expect(result).toBeDefined();
    });
  });
});
