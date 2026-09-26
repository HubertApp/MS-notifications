export class Notification {
  id: string;
  userId: string;
  content: string;
  type: string;
  // Non persiste : porte par le job de livraison, fourni par l'emetteur.
  subject?: string;
  source: string;
  triggeredBy?: string;
  isRead: boolean;
  createdAt: string;
}
