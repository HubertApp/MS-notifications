// Abstraction sur "comment on envoie réellement un mail". Permet de changer
// de fournisseur (SMTP direct, SendGrid, Mailgun, Resend...) sans toucher au
// reste du code : il suffit d'implémenter cette interface et de rebrancher
// le provider dans le module (voir MAIL_PROVIDER).

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface MailProvider {
  send(message: MailMessage): Promise<void>;
}

export const MAIL_PROVIDER = Symbol('MAIL_PROVIDER');
