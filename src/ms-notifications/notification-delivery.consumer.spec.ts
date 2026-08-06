import { RmqContext } from '@nestjs/microservices';
import { NotificationDeliveryConsumer } from './notification-delivery.consumer';
import { NotificationDeliveryJob } from './notification-delivery.publisher';

describe('NotificationDeliveryConsumer', () => {
  let consumer: NotificationDeliveryConsumer;
  let mockUserLookup: { getEmailForUser: jest.Mock };
  let mockPublisher: { publishJob: jest.Mock; publishFailed: jest.Mock };
  let mockEmailChannel: { type: string; supports: jest.Mock; send: jest.Mock };
  let ack: jest.Mock;

  const baseJob: NotificationDeliveryJob = {
    notificationId: 'notif-1',
    userId: 'user-123',
    content: 'Bienvenue !',
    type: 'WELCOME',
    channelType: 'EMAIL',
    attempts: 0,
  };

  function makeContext(): RmqContext {
    ack = jest.fn();
    const channelRef = { ack };
    const originalMsg = { content: 'stub' };
    return {
      getChannelRef: () => channelRef,
      getMessage: () => originalMsg,
    } as unknown as RmqContext;
  }

  beforeEach(() => {
    mockUserLookup = { getEmailForUser: jest.fn().mockResolvedValue('user@example.com') };
    mockPublisher = {
      publishJob: jest.fn().mockResolvedValue(undefined),
      publishFailed: jest.fn().mockResolvedValue(undefined),
    };
    mockEmailChannel = {
      type: 'EMAIL',
      supports: jest.fn().mockReturnValue(true),
      send: jest.fn().mockResolvedValue(undefined),
    };

    consumer = new NotificationDeliveryConsumer(
      mockUserLookup as any,
      mockPublisher as any,
      [mockEmailChannel as any],
    );
  });

  it('shouldAckAndSendWhenDeliverySucceeds', async () => {
    const ctx = makeContext();

    await consumer.handleDelivery(baseJob, ctx);

    expect(mockEmailChannel.send).toHaveBeenCalledTimes(1);
    expect(ack).toHaveBeenCalledTimes(1);
    expect(mockPublisher.publishJob).not.toHaveBeenCalled();
    expect(mockPublisher.publishFailed).not.toHaveBeenCalled();
  });

  it('shouldUseTheEmailAlreadyProvidedInTheJobWithoutCallingUserLookup', async () => {
    const ctx = makeContext();

    await consumer.handleDelivery({ ...baseJob, email: 'already@example.com' }, ctx);

    expect(mockUserLookup.getEmailForUser).not.toHaveBeenCalled();
    expect(mockEmailChannel.send).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ email: 'already@example.com' }),
    );
  });

  it('shouldResolveTheEmailViaUserLookupWhenNotProvided', async () => {
    const ctx = makeContext();

    await consumer.handleDelivery(baseJob, ctx);

    expect(mockUserLookup.getEmailForUser).toHaveBeenCalledWith('user-123');
  });

  it('shouldAckAndSkipWhenTheChannelTypeIsUnknown', async () => {
    const ctx = makeContext();

    await consumer.handleDelivery({ ...baseJob, channelType: 'SMS' }, ctx);

    expect(mockEmailChannel.send).not.toHaveBeenCalled();
    expect(ack).toHaveBeenCalledTimes(1);
  });

  it('shouldAckAndSkipWhenTheChannelDoesNotSupportTheRecipient', async () => {
    mockEmailChannel.supports.mockReturnValue(false);
    const ctx = makeContext();

    await consumer.handleDelivery(baseJob, ctx);

    expect(mockEmailChannel.send).not.toHaveBeenCalled();
    expect(ack).toHaveBeenCalledTimes(1);
  });

  it('shouldRepublishWithIncrementedAttemptsOnFailureBelowMaxAttempts', async () => {
    mockEmailChannel.send.mockRejectedValueOnce(new Error('SMTP down'));
    const ctx = makeContext();

    await consumer.handleDelivery(baseJob, ctx);

    expect(mockPublisher.publishJob).toHaveBeenCalledWith(
      expect.objectContaining({ attempts: 1 }),
    );
    expect(mockPublisher.publishFailed).not.toHaveBeenCalled();
    expect(ack).toHaveBeenCalledTimes(1);
  }, 10000);

  it('shouldGiveUpAndPublishToTheFailedQueueAfterMaxAttempts', async () => {
    mockEmailChannel.send.mockRejectedValueOnce(new Error('SMTP down'));
    const ctx = makeContext();

    await consumer.handleDelivery({ ...baseJob, attempts: 4 }, ctx);

    expect(mockPublisher.publishFailed).toHaveBeenCalledWith(
      expect.objectContaining({ attempts: 5 }),
      'SMTP down',
    );
    expect(mockPublisher.publishJob).not.toHaveBeenCalled();
    expect(ack).toHaveBeenCalledTimes(1);
  });
});
