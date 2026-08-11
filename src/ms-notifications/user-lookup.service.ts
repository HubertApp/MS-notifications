import { Injectable, Logger } from '@nestjs/common';
import { GraphQLClient, gql } from 'graphql-request';

// Résout l'e-mail d'un utilisateur via MS-User. Voir ARCHITECTURE.md §4.
@Injectable()
export class UserLookupService {
  private readonly logger = new Logger(UserLookupService.name);
  private readonly client: GraphQLClient;

  constructor() {
    this.client = new GraphQLClient(
      process.env.MS_USER_URL || 'http://localhost:3001/graphql',
      {
        headers: {
          'x-user-id': 'ms-notifications',
          'x-auth-state': 'VALID',
          'x-user-role': 'SERVICE',
        },
      },
    );
  }

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
