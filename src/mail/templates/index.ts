import { EmailTemplate } from './email-template.interface';
import { welcomeEmailTemplate } from './welcome.template';
import { accountDeletedEmailTemplate } from './account-deleted.template';
import { genericEmailTemplate } from './generic.template';

export { renderEmailLayout } from './email-layout.template';
export * from './email-template.interface';

// Registre type de notification -> template. Ajouter un nouveau type de
// notification email.
const EMAIL_TEMPLATES: Record<string, EmailTemplate> = {
  WELCOME: welcomeEmailTemplate,
  ACCOUNT_DELETED: accountDeletedEmailTemplate,
};

export function getEmailTemplate(notificationType: string): EmailTemplate {
  return EMAIL_TEMPLATES[notificationType] ?? genericEmailTemplate;
}
