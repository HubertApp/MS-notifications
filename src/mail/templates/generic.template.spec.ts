import { genericEmailTemplate } from './generic.template';
import { EmailTemplateContext } from './email-template.interface';

describe('genericEmailTemplate', () => {
  function makeContext(
    overrides: Partial<EmailTemplateContext> = {},
  ): EmailTemplateContext {
    return {
      notification: {
        id: 'notif-1',
        userId: 'user-1',
        content: 'Contenu quelconque',
        type: 'INFO',
        source: 'test',
        isRead: false,
        createdAt: new Date().toISOString(),
      },
      recipient: { userId: 'user-1', email: 'user@example.com' },
      frontUrl: 'https://front.hubertapp.example',
      unsubscribeUrl: 'https://front.hubertapp.example/desabonnement?userId=user-1',
      escapeHtml: (text) => text,
      ...overrides,
    };
  }

  it('should use a neutral, generic subject', () => {
    expect(genericEmailTemplate.subject).toBe(
      'Nouvelle notification HubertApp',
    );
  });

  it('should delegate escaping of the notification content to the provided escapeHtml', () => {
    const escapeHtml = jest.fn((text: string) => `ESCAPED(${text})`);

    const content = genericEmailTemplate.build(
      makeContext({ escapeHtml, notification: makeContext().notification }),
    );

    expect(escapeHtml).toHaveBeenCalledWith('Contenu quelconque');
    expect(content.bodyHtml).toBe('ESCAPED(Contenu quelconque)');
  });

  it('should not include a call to action or feature rows', () => {
    const content = genericEmailTemplate.build(makeContext());

    expect(content.cta).toBeUndefined();
    expect(content.featureRows).toBeUndefined();
  });
});
