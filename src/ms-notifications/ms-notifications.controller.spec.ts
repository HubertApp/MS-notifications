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

  describe('handleTransitNetworkAggregated', () => {
    const envInitial = { ...process.env };

    beforeEach(() => {
      process.env.ADMIN_NOTIFICATION_EMAIL = 'admin@hubertapp.local';
      process.env.ADMIN_USER_ID = 'admin';
    });

    afterEach(() => {
      process.env = { ...envInitial };
    });

    it('shouldEmailTheConfiguredAdminWhenAggregationSucceeds', async () => {
      await controller.handleTransitNetworkAggregated({
        network_id: 'net-1',
        network_name: 'Réseau test',
        status: 'ok',
        error: null,
      });

      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'admin',
          recipientEmail: 'admin@hubertapp.local',
          channels: ['EMAIL'],
          type: 'AGGREGATION_SUCCESS',
          source: 'rabbitmq:transit_network_aggregated',
          triggeredBy: 'ms-admin',
        }),
      );
      expect(mockDispatcher.dispatch.mock.calls[0][0].content).toContain(
        'Réseau test',
      );
    });

    it('shouldEmailTheConfiguredAdminWithTheReasonWhenAggregationFails', async () => {
      await controller.handleTransitNetworkAggregated({
        network_id: 'net-1',
        status: 'error',
        error: 'flux corrompu',
      });

      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'AGGREGATION_ERROR' }),
      );
      expect(mockDispatcher.dispatch.mock.calls[0][0].content).toContain(
        'flux corrompu',
      );
    });

    it('shouldNotDispatchAnythingWhenNoAdminEmailIsConfigured', async () => {
      delete process.env.ADMIN_NOTIFICATION_EMAIL;

      await controller.handleTransitNetworkAggregated({
        network_id: 'net-1',
        status: 'ok',
      });

      expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
    });
  });
});
