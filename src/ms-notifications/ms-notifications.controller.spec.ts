import { NotificationsController } from './ms-notifications.controller';
import { NotificationDispatcherService } from './ms-notifications-dispatcher.service';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let mockDispatcher: { dispatch: jest.Mock };

  beforeEach(() => {
    mockDispatcher = {
      dispatch: jest.fn().mockResolvedValue({ id: 'notif-1' }),
    };
    controller = new NotificationsController(
      mockDispatcher as unknown as NotificationDispatcherService,
    );
  });

  describe('handleUserCreated', () => {
    it('should dispatch an EMAIL notification with type WELCOME by default', async () => {
      await controller.handleUserCreated({
        user_id: 'user-1',
        email: 'user1@test.com',
        pseudo: 'Alice',
        disabledChannels: [],
      });

      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          type: 'WELCOME',
          channels: ['EMAIL'],
          recipientEmail: 'user1@test.com',
          recipientDisabledChannels: [],
          source: 'rabbitmq:user_created',
        }),
      );
    });

    it('should include the pseudo in the welcome content when present', async () => {
      await controller.handleUserCreated({
        user_id: 'user-1',
        email: 'user1@test.com',
        pseudo: 'Alice',
      });

      const call = mockDispatcher.dispatch.mock.calls[0][0];
      expect(call.content).toContain('Alice');
    });

    it('should fall back to the email in the content when pseudo is absent', async () => {
      await controller.handleUserCreated({
        user_id: 'user-1',
        email: 'user1@test.com',
      } as any);

      const call = mockDispatcher.dispatch.mock.calls[0][0];
      expect(call.content).toContain('user1@test.com');
    });

    it('should ignore the event when user_id is missing', async () => {
      await controller.handleUserCreated({ email: 'x@test.com' } as any);

      expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('should ignore the event when email is missing', async () => {
      await controller.handleUserCreated({ user_id: 'user-1' } as any);

      expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('should not throw when the dispatcher rejects (fire-and-forget from the broker side)', async () => {
      mockDispatcher.dispatch.mockRejectedValueOnce(new Error('db down'));

      await expect(
        controller.handleUserCreated({
          user_id: 'user-1',
          email: 'user1@test.com',
        }),
      ).resolves.toBeUndefined();
    });

    it('should pass disabledChannels to the dispatcher', async () => {
      await controller.handleUserCreated({
        user_id: 'user-1',
        email: 'user1@test.com',
        pseudo: 'Alice',
        disabledChannels: ['EMAIL'],
      });

      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientDisabledChannels: ['EMAIL'],
        }),
      );
    });

    it('should default to empty array when disabledChannels is missing', async () => {
      await controller.handleUserCreated({
        user_id: 'user-1',
        email: 'user1@test.com',
      });

      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientDisabledChannels: [],
        }),
      );
    });
  });

  describe('handleUserDeleted', () => {
    it('should dispatch an EMAIL notification with type ACCOUNT_DELETED by default', async () => {
      await controller.handleUserDeleted({
        user_id: 'user-1',
        email: 'user1@test.com',
        pseudo: 'Alice',
        disabledChannels: [],
      });

      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          type: 'ACCOUNT_DELETED',
          channels: ['EMAIL'],
          recipientEmail: 'user1@test.com',
          recipientDisabledChannels: [],
          source: 'rabbitmq:user_deleted',
        }),
      );
    });

    it('should ignore the event when user_id is missing', async () => {
      await controller.handleUserDeleted({ email: 'x@test.com' } as any);

      expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('should ignore the event when email is missing', async () => {
      await controller.handleUserDeleted({ user_id: 'user-1' } as any);

      expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('should not throw when the dispatcher rejects (fire-and-forget from the broker side)', async () => {
      mockDispatcher.dispatch.mockRejectedValueOnce(new Error('db down'));

      await expect(
        controller.handleUserDeleted({
          user_id: 'user-1',
          email: 'user1@test.com',
        }),
      ).resolves.toBeUndefined();
    });

    it('should uppercase a custom template into the notification type', async () => {
      await controller.handleUserDeleted({
        user_id: 'user-1',
        email: 'user1@test.com',
        template: 'account_deleted',
      });

      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'ACCOUNT_DELETED' }),
      );
    });

    it('should pass disabledChannels to the dispatcher', async () => {
      await controller.handleUserDeleted({
        user_id: 'user-1',
        email: 'user1@test.com',
        disabledChannels: ['EMAIL'],
      });

      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientDisabledChannels: ['EMAIL'],
        }),
      );
    });

    it('should default to empty array when disabledChannels is missing', async () => {
      await controller.handleUserDeleted({
        user_id: 'user-1',
        email: 'user1@test.com',
      });

      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientDisabledChannels: [],
        }),
      );
    });
  });

  describe('handleNotificationRequested', () => {
    const baseEvent = {
      user_id: 'admin',
      recipient_email: 'admin@hubertapp.local',
      subject: 'Objet choisi par l’émetteur',
      content: 'Contenu rédigé par l’émetteur',
      type: 'ANY_LABEL',
      channels: ['EMAIL'],
      triggered_by: 'ms-admin',
    };

    it('shouldDispatchExactlyWhatTheEmitterProvided', async () => {
      await controller.handleNotificationRequested(baseEvent);

      expect(mockDispatcher.dispatch).toHaveBeenCalledTimes(1);
      expect(mockDispatcher.dispatch).toHaveBeenCalledWith({
        userId: 'admin',
        recipientEmail: 'admin@hubertapp.local',
        recipientDisabledChannels: [],
        subject: 'Objet choisi par l’émetteur',
        content: 'Contenu rédigé par l’émetteur',
        type: 'ANY_LABEL',
        channels: ['EMAIL'],
        source: 'rabbitmq:notification_requested',
        triggeredBy: 'ms-admin',
      });
    });

    it('shouldForwardTheDisabledChannelsProvidedByTheEmitter', async () => {
      await controller.handleNotificationRequested({
        ...baseEvent,
        disabled_channels: ['EMAIL'],
      });

      expect(
        mockDispatcher.dispatch.mock.calls[0][0].recipientDisabledChannels,
      ).toEqual(['EMAIL']);
    });

    it('shouldLeaveTheSubjectUndefinedWhenTheEmitterSendsNull', async () => {
      await controller.handleNotificationRequested({
        ...baseEvent,
        subject: null,
      });

      expect(mockDispatcher.dispatch.mock.calls[0][0].subject).toBeUndefined();
    });

    it.each([
      ['user_id', { user_id: '' }],
      ['content', { content: '' }],
      ['type', { type: '' }],
      ['channels', { channels: [] }],
      ['recipient_email', { recipient_email: null }],
    ])('shouldIgnoreTheEventWhen%sIsMissing', async (_champ, override) => {
      await controller.handleNotificationRequested({
        ...baseEvent,
        ...override,
      } as any);

      expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('shouldSwallowDispatchFailuresSoTheBrokerDoesNotRedeliver', async () => {
      mockDispatcher.dispatch.mockRejectedValueOnce(new Error('Mongo down'));

      await expect(
        controller.handleNotificationRequested(baseEvent),
      ).resolves.toBeUndefined();
    });
  });
});
