// Contrat generique : l'emetteur fournit tout ce qu'il faut pour livrer
// (destinataire, objet, contenu, canaux). Ce service ne redige ni ne choisit
// rien, il persiste puis livre tel quel.
//
// Les emetteurs Python (MS-Admin) n'ont pas de ClientProxy Nest et construisent
// l'enveloppe { pattern, data } a la main : champs en snake_case, comme
// user_created emis par MS-User.
export const NOTIFICATION_REQUESTED_PATTERN = 'notification_requested';

export interface NotificationRequestedEvent {
  user_id: string;

  // Obligatoire des que channels contient EMAIL : aucune adresse n'est
  // resolue par ce service.
  recipient_email?: string | null;

  // Canaux desactives par le destinataire, respectes a la livraison.
  disabled_channels?: string[];

  // Objet du mail. Absent : objet generique du canal EMAIL.
  subject?: string | null;

  content: string;

  // Simple etiquette de persistance, jamais interpretee ici.
  type: string;

  channels: string[];

  // Service emetteur, ex: 'ms-admin'.
  triggered_by: string;

  occurred_at?: string;
}
