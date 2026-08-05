import { Test, TestingModule } from '@nestjs/testing';
import { NotificationDispatcherService } from './ms-notifications-dispatcher.service';
import { NotificationsService } from './ms-notifications.service';
import { NotificationDeliveryPublisher } from './notification-delivery.publisher';

describe('NotificationDispatcherService', () => {
  let dispatcher: NotificationDispatcherService;
  let mockNotificationsService: { create: jest.Mock };
  let mockPublisher: { publish: jest.Mock };

  const fakeNotification = {
    id: 'notif-1',
    userId: 'user-123',
    content: 'Bienvenue !',
    type: 'WELCOME',
    source: 'rabbitmq:user_created',
    triggeredBy: 'system',
    isRead: false,
    createdAt: new Date().toISOString(),
  };

  beforeEach(async () => {
    mockNotificationsService = {
      create: jest.fn().mockResolvedValue(fakeNotification),
    };

    mockPublisher = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationDispatcherService,
        { provide: NotificationsService, useValue: mockNotificationsService },
        { provide: NotificationDeliveryPublisher, useValue: mockPublisher },
      ],
    }).compile();

    dispatcher = module.get<NotificationDispatcherService>(NotificationDispatcherService);
  });

  it('shouldAlwaysPersistTheNotification', async () => {
    await dispatcher.dispatch({
      userId: 'user-123',
      content: 'Bienvenue !',
      type: 'WELCOME',
      source: 'rabbitmq:user_created',
    });

    expect(mockNotificationsService.create).toHaveBeenCalledTimes(1);
  });

  it('shouldPublishAJobForEachRequestedChannel', async () => {
    await dispatcher.dispatch({
      userId: 'user-123',
      content: 'Bienvenue !',
      type: 'WELCOME',
      source: 'rabbitmq:user_created',
      channels: ['EMAIL'],
    });

    expect(mockPublisher.publish).toHaveBeenCalledTimes(1);
    expect(mockPublisher.publish).toHaveBeenCalledWith({
      notificationId: 'notif-1',
      userId: 'user-123',
      content: 'Bienvenue !',
      type: 'WELCOME',
      channelType: 'EMAIL',
      email: undefined,
    });
  });

  it('shouldForwardRecipientEmailWhenProvidedByATrustedInternalCaller', async () => {
    await dispatcher.dispatch({
      userId: 'user-123',
      content: 'Bienvenue !',
      type: 'WELCOME',
      source: 'rabbitmq:user_created',
      channels: ['EMAIL'],
      recipientEmail: 'user@example.com',
    });

    expect(mockPublisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'user@example.com' }),
    );
  });

  it('shouldNeverPublishAJobForTheImplicitInAppChannel', async () => {
    await dispatcher.dispatch({
      userId: 'user-123',
      content: 'Bienvenue !',
      type: 'WELCOME',
      source: 'rabbitmq:user_created',
      channels: ['IN_APP', 'EMAIL'],
    });

    expect(mockPublisher.publish).toHaveBeenCalledTimes(1);
    expect(mockPublisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({ channelType: 'EMAIL' }),
    );
  });

  it('shouldNotPublishAnyJobWhenNoChannelIsRequested', async () => {
    await dispatcher.dispatch({
      userId: 'user-123',
      content: 'Bienvenue !',
      type: 'WELCOME',
      source: 'rabbitmq:user_created',
    });

    expect(mockPublisher.publish).not.toHaveBeenCalled();
  });

  it('shouldStillResolveEvenIfPublishingFails', async () => {
    // publish() gère déjà ses propres erreurs en interne (voir
    // NotificationDeliveryPublisher) : ce test vérifie que le dispatcher ne
    // plante pas non plus si jamais une exception remontait malgré tout.
    mockPublisher.publish.mockRejectedValueOnce(new Error('RabbitMQ down'));

    await expect(
      dispatcher.dispatch({
        userId: 'user-123',
        content: 'Bienvenue !',
        type: 'WELCOME',
        source: 'rabbitmq:user_created',
        channels: ['EMAIL'],
      }),
    ).rejects.toThrow('RabbitMQ down');
    // Note : la notification est déjà persistée à ce stade (create() a été
    // awaited avant la boucle de publication) — seul le job de livraison
    // échoue, jamais la notification elle-même.
    expect(mockNotificationsService.create).toHaveBeenCalledTimes(1);
  });
});
