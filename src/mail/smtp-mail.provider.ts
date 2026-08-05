import { Injectable, Logger } from '@nestjs/common';
import { createTransport, Transporter } from 'nodemailer';
import { MailMessage, MailProvider } from './mail-provider.interface';

// Implémentation SMTP générique : fonctionne avec n'importe quel serveur SMTP
// (Gmail, LWS, SendGrid en mode relais SMTP, Mailtrap pour les tests...).
// Tout est piloté par variables d'environnement, rien n'est codé en dur.
@Injectable()
export class SmtpMailProvider implements MailProvider {
  private readonly logger = new Logger(SmtpMailProvider.name);
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor() {
    this.from = process.env.SMTP_FROM || 'no-reply@hubertapp.local';

    this.transporter = createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD,
          }
        : undefined,
    });
  }

  async send(message: MailMessage): Promise<void> {
    if (!process.env.SMTP_HOST) {
      // Pas de config SMTP (ex: dev local sans mail configuré) : on log au
      // lieu de planter, pour ne jamais faire échouer une notification à
      // cause d'un canal optionnel non configuré.
      this.logger.warn(
        `SMTP_HOST absent : e-mail à ${message.to} ("${message.subject}") non envoyé.`,
      );
      return;
    }

    await this.transporter.sendMail({
      from: this.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
    this.logger.log(`E-mail envoyé à ${message.to} ("${message.subject}").`);
  }
}
