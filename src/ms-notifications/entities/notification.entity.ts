export class Notification {
  id: string;
  userId: string;
  content: string;
  type: string;
  source: string;
  triggeredBy?: string;
  isRead: boolean;
  createdAt: string;
}
