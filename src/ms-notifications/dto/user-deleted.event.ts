export const USER_DELETED_PATTERN = 'user_deleted';

// Émis par MS-User (UsersService.remove()) juste avant la suppression
// effective du compte, pendant que l'email est encore disponible.
export interface UserDeletedEvent {
  user_id: string;

  email: string;

  pseudo?: string;

  template?: string;

  occurred_at?: string;

  googleId?: string;
}
