import {
  EmailTemplate,
  EmailTemplateContent,
  EmailTemplateContext,
} from './email-template.interface';

// Utilisé pour tout type de notification sans template dédié.
export const genericEmailTemplate: EmailTemplate = {
  subject: 'Nouvelle notification HubertApp',

  build({
    notification,
    escapeHtml,
  }: EmailTemplateContext): EmailTemplateContent {
    return {
      heading: 'Nouvelle notification',
      bodyHtml: escapeHtml(notification.content),
      footerNoteHtml:
        'Vous recevez cet e-mail suite à une notification HubertApp.',
    };
  },
};
