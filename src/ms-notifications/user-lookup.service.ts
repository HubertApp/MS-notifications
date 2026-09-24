import { Injectable, Logger } from '@nestjs/common';
import { GraphQLClient, gql } from 'graphql-request';

// Résout l'e-mail d'un utilisateur via MS-User. Voir ARCHITECTURE.md §4.
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

  async getEmailForUser(userId: string): Promise<string | undefined> {
    const recipient = await this.getRecipientInfo(userId);
    return recipient?.email;
  }

  async getRecipientInfo(
    userId: string,
  ): Promise<{ email?: string; disabledChannels: string[] } | undefined> {
    const query = gql`
      query FindOne($googleId: String!) {
        findOne(googleId: $googleId) {
          email
          notificationChannelsDisabled
        }
      }
    `;

    try {
      const response = await this.client.request<{
        findOne?: { email?: string; notificationChannelsDisabled?: string[] };
      }>(query, { googleId: userId });

      if (!response?.findOne) return undefined;

      return {
        email: response.findOne.email,
        disabledChannels: response.findOne.notificationChannelsDisabled ?? [],
      };
    } catch (err) {
      this.logger.warn(
        `Impossible de récupérer les infos de user_id=${userId} depuis MS-User : ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return undefined;
    }
  }
}
