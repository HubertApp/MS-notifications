import { welcomeEmailTemplate } from './welcome.template';
import { EmailTemplateContext } from './email-template.interface';

describe('welcomeEmailTemplate', () => {
  const context: EmailTemplateContext = {
    notification: {
      id: 'notif-1',
      userId: 'user-1',
      content: 'Bienvenue !',
      type: 'WELCOME',
      source: 'rabbitmq:user_created',
      isRead: false,
      createdAt: new Date().toISOString(),
    },
    recipient: { userId: 'user-1', email: 'user@example.com' },
    frontUrl: 'https://front.hubertapp.example',
    unsubscribeUrl: 'https://front.hubertapp.example/desabonnement?userId=user-1',
    escapeHtml: (text) => text,
  };

  it('should expose a fixed, welcoming subject', () => {
    expect(welcomeEmailTemplate.subject).toBe('Bienvenue sur HubertApp');
  });

  it('should point the CTA to the front URL', () => {
    const content = welcomeEmailTemplate.build(context);

    expect(content.cta).toEqual({
      label: 'Ouvrir HubertApp',
      url: 'https://front.hubertapp.example',
    });
  });

  it('should include the 3 feature highlight rows', () => {
    const content = welcomeEmailTemplate.build(context);

    expect(content.featureRows).toHaveLength(3);
  });

  it('should include an unsubscribe link built from the context URL', () => {
    const content = welcomeEmailTemplate.build(context);

    expect(content.footerNoteHtml).toContain(
      'https://front.hubertapp.example/desabonnement?userId=user-1',
    );
  });
});
