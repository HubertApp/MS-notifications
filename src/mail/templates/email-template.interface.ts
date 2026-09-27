import { Notification } from '../../ms-notifications/entities/notification.entity';
import { NotificationRecipient } from '../../ms-notifications/channels/notification-channel.interface';

/** Une ligne de mise en avant (utilisée par le template de bienvenue). */
export interface EmailFeatureRow {
  badge: string;
  label: string;
}

/** Bouton d'action principal du mail (ex: "Ouvrir HubertApp"). */
export interface EmailCallToAction {
  label: string;
  url: string;
}

/** Contenu structuré produit par un template, avant mise en page HTML. */
export interface EmailTemplateContent {
  heading: string;
  /** HTML déjà sûr (échappé si besoin) : injecté tel quel dans la mise en page. */
  bodyHtml: string;
  featureRows?: EmailFeatureRow[];
  cta?: EmailCallToAction;
  /** HTML déjà sûr, affiché en petit dans le pied de mail. */
  footerNoteHtml: string;
}

/** Contexte fourni à un template pour construire son contenu. */
export interface EmailTemplateContext {
  notification: Notification;
  recipient: NotificationRecipient;
  frontUrl: string;
  unsubscribeUrl: string;
  escapeHtml: (text: string) => string;
}

/**
 * Un template de mail = un sujet + une fonction qui produit le contenu.
 * Chaque template vit dans son propre fichier pour ne jamais avoir de
 * HTML en dur mélangé à la logique d'envoi (email-notification.channel.ts).
 */
export interface EmailTemplate {
  subject: string;
  build(context: EmailTemplateContext): EmailTemplateContent;
}
