import { accountDeletedEmailTemplate } from './account-deleted.template';
import { EmailTemplateContext } from './email-template.interface';

describe('accountDeletedEmailTemplate', () => {
  const context: EmailTemplateContext = {
    notification: {
      id: 'notif-1',
      userId: 'user-1',
      content: 'Votre compte HubertApp a bien été supprimé.',
      type: 'ACCOUNT_DELETED',
      source: 'rabbitmq:user_deleted',
      isRead: false,
      createdAt: new Date().toISOString(),
    },
    recipient: { userId: 'user-1', email: 'user@example.com' },
    frontUrl: 'https://front.hubertapp.example',
    unsubscribeUrl: 'https://front.hubertapp.example/desabonnement?userId=user-1',
    escapeHtml: (text) => text,
  };

  it('should confirm the deletion in its subject', () => {
    expect(accountDeletedEmailTemplate.subject).toBe(
      'Votre compte HubertApp a bien été supprimé',
    );
  });

  it('should not include a call to action (no account left to open)', () => {
    const content = accountDeletedEmailTemplate.build(context);

    expect(content.cta).toBeUndefined();
  });

  it('should not include the feature highlights (not relevant to a deletion confirmation)', () => {
    const content = accountDeletedEmailTemplate.build(context);

    expect(content.featureRows).toBeUndefined();
  });

  it('should mention the deletion is irreversible in the body', () => {
    const content = accountDeletedEmailTemplate.build(context);

    expect(content.bodyHtml).toMatch(/irréversible/i);
  });
});
