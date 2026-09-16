
export const NOTIFICATIONS_QUEUE = 'notifications_queue';
export const USER_CREATED_PATTERN = 'user_created';

export interface UserCreatedEvent {
  user_id: string;

  email: string;

  pseudo?: string;

  // Valeur connue a ce jour : 'welcome'. Le type reste `string` car l'emetteur
  // (MS-User) peut en introduire d'autres sans que ce service soit redeploye.
  template?: string;

  occurred_at?: string;

  googleId?: string;
}