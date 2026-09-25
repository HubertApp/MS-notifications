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
      });

      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          type: 'WELCOME',
          channels: ['EMAIL'],
          recipientEmail: 'user1@test.com',
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
  });

  describe('handleUserDeleted', () => {
    it('should dispatch an EMAIL notification with type ACCOUNT_DELETED by default', async () => {
      await controller.handleUserDeleted({
        user_id: 'user-1',
        email: 'user1@test.com',
        pseudo: 'Alice',
      });

      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          type: 'ACCOUNT_DELETED',
          channels: ['EMAIL'],
          recipientEmail: 'user1@test.com',
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
  });
});
