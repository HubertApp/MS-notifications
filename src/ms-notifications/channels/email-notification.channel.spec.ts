import { EmailNotificationChannel } from './email-notification.channel';
import { Notification } from '../entities/notification.entity';

describe('EmailNotificationChannel', () => {
  let channel: EmailNotificationChannel;
  let mockMailProvider: { send: jest.Mock };

  const baseNotification: Notification = {
    id: 'notif-1',
    userId: 'user-123',
    content: 'Bienvenue !',
    type: 'WELCOME',
    source: 'rabbitmq:user_created',
    isRead: false,
    createdAt: new Date().toISOString(),
  } as Notification;

  beforeEach(() => {
    mockMailProvider = { send: jest.fn().mockResolvedValue(undefined) };
    channel = new EmailNotificationChannel(mockMailProvider as any);
  });

  it('shouldNotSendWhenRecipientHasNoEmail', async () => {
    await channel.send(baseNotification, { userId: 'user-123' });

    expect(mockMailProvider.send).not.toHaveBeenCalled();
  });

  it('shouldSendAnHtmlEmailContainingAnUnsubscribeLinkWithTheUserId', async () => {
    await channel.send(baseNotification, { userId: 'user-123', email: 'user@example.com' });

    expect(mockMailProvider.send).toHaveBeenCalledTimes(1);
    const message = mockMailProvider.send.mock.calls[0][0];
    expect(message.to).toBe('user@example.com');
    expect(message.subject).toBe('Bienvenue sur HubertApp');
    expect(message.html).toContain('/desabonnement?userId=user-123');
  });

  it('shouldEscapeHtmlSpecialCharactersInNonWelcomeContent', async () => {
    await channel.send(
      { ...baseNotification, type: 'INFO', content: '<script>alert(1)</script>' },
      { userId: 'user-123', email: 'user@example.com' },
    );

    const message = mockMailProvider.send.mock.calls[0][0];
    expect(message.html).not.toContain('<script>');
    expect(message.html).toContain('&lt;script&gt;');
  });
});
