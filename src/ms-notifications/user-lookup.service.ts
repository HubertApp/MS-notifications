import { Injectable, Logger } from '@nestjs/common';
import { GraphQLClient, gql } from 'graphql-request';

// Résout l'adresse e-mail d'un utilisateur en interrogeant MS-User — jamais
// l'inverse (on ne fait JAMAIS confiance à un e-mail fourni par un client
// GraphQL public pour savoir "à qui" on envoie un mail). Voir le resolver
// createNotification : aucun argument `email` n'existe côté client.
//
// S'identifie auprès de MS-User comme appelant de confiance interne via le
// rôle "SERVICE", même mécanisme que MS-Auth → MS-User (voir AUDIT.md :
// confiance basée sur des headers non signés, limitation connue et acceptée
// pour l'instant car gérée par le routeur en amont).
@Injectable()
export class UserLookupService {
  private readonly logger = new Logger(UserLookupService.name);
  private readonly client: GraphQLClient;

  constructor() {
    this.client = new GraphQLClient(
      process.env.MS_USER_URL || 'http://service-user:3001/graphql',
      {
        headers: {
          'x-user-id': 'ms-notifications',
          'x-auth-state': 'VALID',
          'x-user-role': 'SERVICE',
        },
      },
    );
  }

  // Retourne undefined (jamais ne lève) si l'utilisateur est introuvable ou
  // si MS-User est injoignable : un canal e-mail indisponible ne doit jamais
  // faire échouer la création d'une notification.
  async getEmailForUser(userId: string): Promise<string | undefined> {
    const query = gql`
      query FindOne($googleId: String!) {
        findOne(googleId: $googleId) {
          email
        }
      }
    `;

    try {
      const response = await this.client.request<{
        findOne?: { email?: string };
      }>(query, { googleId: userId });
      return response?.findOne?.email ?? undefined;
    } catch (err) {
      this.logger.warn(
        `Impossible de récupérer l'e-mail de user_id=${userId} depuis MS-User : ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return undefined;
    }
  }
}
