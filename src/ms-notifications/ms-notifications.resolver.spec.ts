import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { NotificationsResolver } from './ms-notifications.resolver';
import { NotificationsService } from './ms-notifications.service';
import { NotificationDispatcherService } from './ms-notifications-dispatcher.service';
import { AuthenticatedUser } from '../common/guards/federated-auth.guard';

describe('NotificationsResolver', () => {
  let resolver: NotificationsResolver;
  let service: NotificationsService;
  let dispatcher: NotificationDispatcherService;

  const mockNotificationsService = {
    findForUser: jest.fn((userId: string) => [{ id: 'mock-notif', userId }]),
  };

  const mockDispatcher = {
    dispatch: jest.fn((params: any) => ({
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
        {
          provide: NotificationDispatcherService,
          useValue: mockDispatcher,
        },
      ],
    }).compile();

    resolver = module.get<NotificationsResolver>(NotificationsResolver);
    service = module.get<NotificationsService>(NotificationsService);
    dispatcher = module.get<NotificationDispatcherService>(NotificationDispatcherService);
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

      const result = resolver.create('user-123', 'Test Content', undefined, user);

      expect(dispatcher.dispatch).toHaveBeenCalledWith({
        userId: 'user-123',
        content: 'Test Content',
        type: 'MANUAL',
        source: 'graphql:createNotification',
        triggeredBy: 'user-123',
        channels: undefined,
      });
      expect(result).toBeDefined();
    });

    it('shouldRejectAUserCreatingANotificationForSomeoneElse', () => {
      const user = asUser('user-123');

      expect(() =>
        resolver.create('someone-else', 'Test Content', undefined, user),
      ).toThrow(ForbiddenException);
      expect(dispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('shouldAllowAServiceRoleToCreateANotificationForAnyone', () => {
      const serviceUser = asUser('ms-admin', 'SERVICE');

      const result = resolver.create(
        'someone-else',
        'Test Content',
        undefined,
        serviceUser,
      );

      expect(dispatcher.dispatch).toHaveBeenCalledWith({
        userId: 'someone-else',
        content: 'Test Content',
        type: 'SERVICE',
        source: 'graphql:createNotification',
        triggeredBy: 'ms-admin',
        channels: undefined,
      });
      expect(result).toBeDefined();
    });

    it('shouldForwardRequestedChannelsToTheDispatcher', () => {
      const user = asUser('user-123');

      resolver.create('user-123', 'Test Content', ['EMAIL'], user);

      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ channels: ['EMAIL'] }),
      );
    });

    it('shouldNeverAcceptAnEmailArgumentFromTheCaller', () => {
      // Garde-fou de conception : la signature de create() n'expose aucun
      // paramètre "email". Ce test échoue si un tel paramètre est un jour
      // ajouté sans y penser (voir le commentaire de sécurité dans le resolver).
      expect(resolver.create.length).toBe(4); // userId, content, channels, user
    });
  });
});
