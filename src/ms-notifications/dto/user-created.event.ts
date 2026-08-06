
export const NOTIFICATIONS_QUEUE = 'notifications_queue';
export const USER_CREATED_PATTERN = 'user_created';

export interface UserCreatedEvent {
  user_id: string;

  email: string;

  pseudo?: string;

  template?: 'welcome' | string;

  occurred_at?: string;

  googleId?: string;
}