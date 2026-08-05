import { of, throwError } from 'rxjs';
import { NotificationDeliveryPublisher } from './notification-delivery.publisher';

describe('NotificationDeliveryPublisher', () => {
  let publisher: NotificationDeliveryPublisher;
  let mockClient: { emit: jest.Mock };
  let mockFailedClient: { emit: jest.Mock };

  beforeEach(() => {
    mockClient = { emit: jest.fn().mockReturnValue(of(undefined)) };
    mockFailedClient = { emit: jest.fn().mockReturnValue(of(undefined)) };
    publisher = new NotificationDeliveryPublisher(
      mockClient as any,
      mockFailedClient as any,
    );
  });

  it('shouldPublishANewJobWithAttemptsAtZero', async () => {
    await publisher.publish({
      notificationId: 'notif-1',
      userId: 'user-1',
      content: 'Bienvenue',
      type: 'WELCOME',
      channelType: 'EMAIL',
    });

    expect(mockClient.emit).toHaveBeenCalledWith(
      'notification_delivery',
      expect.objectContaining({ notificationId: 'notif-1', attempts: 0 }),
    );
  });

  it('shouldPublishAJobWithAnExplicitAttemptsCountOnRetry', async () => {
    await publisher.publishJob({
      notificationId: 'notif-1',
      userId: 'user-1',
      content: 'Bienvenue',
      type: 'WELCOME',
      channelType: 'EMAIL',
      attempts: 3,
    });

    expect(mockClient.emit).toHaveBeenCalledWith(
      'notification_delivery',
      expect.objectContaining({ attempts: 3 }),
    );
  });

  it('shouldPublishToTheFailedQueueWithAReason', async () => {
    await publisher.publishFailed(
      {
        notificationId: 'notif-1',
        userId: 'user-1',
        content: 'Bienvenue',
        type: 'WELCOME',
        channelType: 'EMAIL',
        attempts: 5,
      },
      'SMTP down',
    );

    expect(mockFailedClient.emit).toHaveBeenCalledWith(
      'notification_delivery_failed',
      expect.objectContaining({ notificationId: 'notif-1', failureReason: 'SMTP down' }),
    );
  });

  it('shouldNotThrowWhenTheBrokerIsUnreachable', async () => {
    mockClient.emit.mockReturnValue(throwError(() => new Error('connect ECONNREFUSED')));

    await expect(
      publisher.publish({
        notificationId: 'notif-1',
        userId: 'user-1',
        content: 'Bienvenue',
        type: 'WELCOME',
        channelType: 'EMAIL',
      }),
    ).resolves.toBeUndefined();
  });
});
