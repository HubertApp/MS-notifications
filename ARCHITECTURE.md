# MS-notifications — fonctionnement

Microservice NestJS responsable de la création, de la persistance et de la livraison des notifications utilisateur (in-app + e-mail, extensible à d'autres canaux).

## Vue d'ensemble

```
                     ┌─────────────────────────┐
  event RabbitMQ     │                         │   GraphQL
  "user_created" ───▶│  NotificationDispatcher  │◀─── createNotification
                     │  Service                 │      (mutation)
                     │                         │
                     │  1. persiste (Mongo)     │
                     │  2. publie un job par    │
                     │     canal demandé        │
                     └───────────┬─────────────┘
                                 │
                                 ▼
                   notification_delivery_queue (RabbitMQ, durable)
                                 │
                                 ▼
                   ┌─────────────────────────┐
                   │ NotificationDelivery      │
                   │ Consumer                  │
                   │                           │
                   │  - résout l'e-mail si     │
                   │    besoin (MS-User)       │
                   │  - exécute le             │
                   │    NotificationChannel    │
                   │    (pattern Stratégie)    │
                   │  - ack manuel             │
                   │  - retry + backoff si     │
                   │    échec (5 essais max)   │
                   └───────────┬───────────────┘
                                 │ échec définitif
                                 ▼
                notification_delivery_failed_queue (dead-letter)
                                 │
                                 ▼
                   NotificationDeliveryFailedConsumer (log uniquement)
```

Le point central de cette architecture : **la persistance de la notification et la livraison effective (SMTP, futur SMS/push...) sont deux opérations complètement découplées**, reliées uniquement par la queue RabbitMQ. Un appelant GraphQL ou un event RabbitMQ entrant n'attend jamais qu'un e-mail parte réellement — seulement que la notification soit enregistrée et le job de livraison publié.

## 1. Points d'entrée

Deux façons de créer une notification :

- **Event RabbitMQ `user_created`** (`ms-notifications.controller.ts`) : consommé automatiquement à l'inscription d'un nouvel utilisateur (queue `notifications_queue`), déclenche une notification de bienvenue avec canal `EMAIL`, l'e-mail venant directement du payload de l'événement (`recipientEmail`).
- **Mutation GraphQL `createNotification`** (`ms-notifications.resolver.ts`) : appelable par un utilisateur authentifié (pour lui-même) ou par un service interne avec le rôle `SERVICE` (pour un tiers). Prend `userId`, `content`, `type`, et optionnellement `channels: [String!]` (ex: `["EMAIL"]`).

Les deux passent par `NotificationDispatcherService.dispatch()`.

## 2. Persistance

Chaque notification est stockée dans MongoDB (`ms-notifications.service.ts`, schéma Mongoose) avec : `userId`, `content`, `type` (catégorie fonctionnelle : `WELCOME`, `MANUAL`, `SERVICE`...), `source` (origine technique : `rabbitmq:user_created`, `graphql:createNotification`), `triggeredBy`, `isRead`, `createdAt`. C'est la seule opération que `dispatch()` attend réellement avant de répondre à l'appelant — une notification "in-app" existe dès que cette écriture réussit, indépendamment de tout canal externe.

## 3. Pattern Stratégie : les canaux de notification

`src/ms-notifications/channels/notification-channel.interface.ts` définit le contrat commun :

```ts
interface NotificationChannel {
  readonly type: string;                              // "IN_APP", "EMAIL"...
  supports(recipient: NotificationRecipient): boolean; // a-t-on ce qu'il faut pour livrer ?
  send(notification: Notification, recipient: NotificationRecipient): Promise<void>;
}
```

Deux implémentations actuelles :

- **`InAppNotificationChannel`** : `send()` ne fait rien — la persistance Mongo *est* la livraison pour ce canal.
- **`EmailNotificationChannel`** : construit le sujet/corps du mail selon `type`, délègue l'envoi à un `MailProvider` injecté.

Toutes les stratégies sont injectées comme un tableau via un provider factory (token `NOTIFICATION_CHANNELS`, voir `ms-notifications.module.ts`). Ajouter un canal SMS ou push plus tard = créer une nouvelle classe implémentant `NotificationChannel` et l'ajouter à ce tableau — aucun autre fichier à toucher.

### Abstraction mail : `MailProvider`

`src/mail/mail-provider.interface.ts` définit `MailProvider.send(message)`. Implémentation par défaut : `SmtpMailProvider` (nodemailer), entièrement configurée par variables d'environnement (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`). Si `SMTP_HOST` n'est pas défini, l'envoi est simplement logué au lieu de planter — pratique en dev local sans serveur SMTP réel. Changer de fournisseur (SendGrid, SES...) = implémenter `MailProvider` autrement, sans toucher au reste.

## 4. Résolution de l'e-mail — décision de sécurité

`createNotification` **n'accepte aucun argument `email` côté client**. Quand un canal `EMAIL` est demandé sans e-mail déjà connu (cas du dispatch via GraphQL), c'est `UserLookupService` qui va chercher l'adresse auprès de MS-User (`findOne(googleId)` en GraphQL), avec le même mécanisme d'appel de confiance interservice que MS-Auth → MS-User (headers `x-user-id` / `x-auth-state: VALID` / `x-user-role: SERVICE`).

Pourquoi ne jamais laisser l'appelant fournir l'e-mail : un `userId` est stable et vérifiable côté serveur, alors qu'un e-mail fourni par le client ne l'est pas. Sans cette contrainte, un appelant (utilisateur normal ou service compromis) pourrait faire partir un mail vers n'importe quelle adresse en donnant un `userId` valide et un e-mail arbitraire — détournement de notification, spam/phishing en abusant du domaine d'envoi de confiance de HubertApp, ou fuite d'info si le contenu est sensible.

Seule exception : l'event RabbitMQ `user_created` transmet `recipientEmail` directement, car il vient du payload interne généré par MS-User lui-même au moment de l'inscription — jamais d'un client GraphQL public.

## 5. Queue de livraison durable (RabbitMQ)

C'est la partie qui garantit qu'un job de livraison n'est jamais perdu, même si le service crashe.

### Producteur (`NotificationDeliveryPublisher`)

Après avoir persisté la notification, `NotificationDispatcherService` publie un job par canal demandé (sauf `IN_APP`, qui n'a rien à livrer) :

```ts
interface NotificationDeliveryJob {
  notificationId: string;
  userId: string;
  content: string;
  type: string;
  channelType: string;   // "EMAIL"...
  email?: string;         // connu à l'avance (event) ou résolu plus tard (consumer)
  attempts: number;       // compteur de tentatives, porté dans le message lui-même
}
```

Publié sur `notification_delivery_queue`, déclarée `durable: true` : les messages survivent à un redémarrage de RabbitMQ.

### Consumer (`NotificationDeliveryConsumer`)

Écoute `notification_delivery_queue` avec `noAck: false` (ack manuel). Pour chaque job :

1. Trouve la stratégie correspondant à `channelType` (pattern Stratégie, cf. §3).
2. Résout l'e-mail si absent du job (`UserLookupService`, cf. §4).
3. Vérifie `channel.supports(recipient)` (ex : pas d'e-mail trouvé → pas de tentative inutile).
4. Appelle `channel.send(...)`.
5. **Succès** → `ack` immédiat, le message est retiré définitivement de la queue.
6. **Échec** → voir retry ci-dessous.

### Retry avec backoff

RabbitMQ ne modifie jamais le contenu d'un message redélivré — le compteur d'essais doit donc être porté explicitement dans le payload. En cas d'échec :

- `attempts < 5` : attente `min(attempts * 2000, 10000)` ms (2s, 4s, 6s, 8s, 10s), puis republication d'un job identique avec `attempts` incrémenté, puis `ack` du message original (il ne sera pas redélivré tel quel par RabbitMQ — c'est la republication manuelle qui fait office de retry).
- `attempts >= 5` : le job est publié sur `notification_delivery_failed_queue` (dead-letter) avec la raison de l'échec, puis `ack` du message original. Abandon définitif pour ce job.

Ce traitement est **séquentiel par instance de consumer** (pas de parallélisation interne, façon `prefetch=1`) : c'est un compromis assumé pour ne jamais bombarder un serveur SMTP en parallèle sans limite. Si le débit devient insuffisant, la bonne réponse est de faire tourner plusieurs instances du service (RabbitMQ répartit alors les messages entre les consumers d'une même queue), pas de paralléliser l'attente à l'intérieur d'un seul process.

### Dead-letter (`NotificationDeliveryFailedConsumer`)

Écoute `notification_delivery_failed_queue`, ack automatique, ne fait que logger l'échec (`notif`, `userId`, `channelType`, nombre d'essais, raison). Objectif : que les échecs définitifs soient visibles (`kubectl logs`, alerting) plutôt que silencieusement perdus dans une queue que personne ne surveille. Pas de retraitement automatique depuis cette queue à ce stade — une reprise manuelle nécessiterait de republier le job sur la queue principale.

### Pourquoi ce découplage règle le problème de durabilité

Dans une version antérieure (fire-and-forget en mémoire), un crash du process entre la persistance Mongo et l'envoi effectif du mail perdait silencieusement ce mail. Avec la queue RabbitMQ durable, le job de livraison existe indépendamment du process qui l'a publié : au redémarrage, un nouveau consumer reprend les messages en attente. Seule fenêtre de perte possible désormais : un crash *avant même* la publication du job (entre l'écriture Mongo et l'appel `publisher.publish()`), fenêtre très courte et sans opération bloquante entre les deux.

## 6. API GraphQL

- `getAllNotifications: [Notification!]!` — retourne uniquement les notifications **non lues** de l'appelant authentifié (le nom du champ est conservé pour compatibilité, mais son comportement a changé lors de l'audit sécurité : plus jamais toutes les notifications de tous les utilisateurs). Une fois marquée lue, une notification disparaît de ce résultat mais reste en base.
- `createNotification(userId: ID!, content: String!, channels: [String!]): Notification!` — voir §4 pour ce qui est volontairement absent (`email`).
- `markNotificationAsRead(id: ID!): Notification!` — passe `isRead` à `true`. Réservé au propriétaire de la notification (ou à un appelant `role: SERVICE`), sinon `ForbiddenException`. C'est le mécanisme utilisé par le centre de notifications du front pour "supprimer" une notif de l'affichage sans la supprimer en base.

## 7. Authentification / autorisation

`FederatedAuthGuard` (même pattern que MS-User) exige les headers `x-user-id`, `x-auth-state: VALID`, `x-user-role`. Règles d'autorisation dans le resolver :

- Un utilisateur avec un rôle normal ne peut créer/lire que ses propres notifications (`userId` de la requête doit correspondre à `x-user-id`).
- Un appelant avec le rôle `SERVICE` peut créer une notification pour n'importe quel `userId` (cas d'usage interservice, ex: MS-User déclenchant une notification via GraphQL plutôt que RabbitMQ).

Comme documenté dans `AUDIT.md`, ce guard fait confiance aux headers sans vérification cryptographique — une vraie garantie nécessite un gateway/mTLS en amont, hors du périmètre de ce service seul.

## 8. Tests

- **Unitaires** (`*.spec.ts` à côté de chaque fichier) : chaque service/consumer/publisher isolé, toutes les dépendances mockées.
- **Intégration** (`test/integration/notifications.integration-spec.ts`) : vrai module Nest, vraie base MongoDB en mémoire (`mongodb-memory-server`), capture du job publié par le dispatcher puis rejeu de ce job exact sur le vrai `NotificationDeliveryConsumer` (valide tout le pipeline producteur → consumer sans connexion à un vrai broker RabbitMQ). Commande : `npm run test:integration`.
- **Performance** (`test/performance/notifications.perf-spec.ts`) : débit du producteur, débit du consumer, non-blocage du producteur par un consumer lent. Toutes les I/O sont simulées (latences déterministes) pour rester rapide et stable en CI. Commande : `npm run test:perf`.
- **Charge HTTP réelle** (`scripts/load-test.mjs`, `npm run test:load`) : autocannon contre une instance qui tourne réellement, à lancer manuellement (hors CI).

## 9. Variables d'environnement clés

| Variable | Rôle |
|---|---|
| `MONGO_URL` | Connexion MongoDB pour la persistance des notifications |
| `RABBITMQ_URL` | Connexion RabbitMQ pour `notification_delivery_queue` / `notification_delivery_failed_queue` (défaut `amqp://rabbitmq:5672`) |
| `MS_USER_URL` | Endpoint GraphQL de MS-User, utilisé par `UserLookupService` |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | Configuration du serveur SMTP réel ; si `SMTP_HOST` absent, envoi simulé (log uniquement) |

Note : la connexion RabbitMQ historique (`notifications_queue` / event `user_created`, dans `main.ts`) garde une URL codée en dur plutôt que `RABBITMQ_URL` — incohérence mineure documentée dans `AUDIT.md`, sans impact tant que la valeur par défaut n'est pas changée.

## 10. TLS interne (amqps / https)

Suite à des findings Sonar (`amqp`/`http` non chiffrés), une CA interne auto-signée (`hubertapp-internal-ca`, 10 ans) signe deux certificats :

- `rabbitmq-tls` (CN `rabbitmq`) : listener TLS RabbitMQ sur 5671 en plus du 5672 en clair (celui-ci reste ouvert pour MS-User/MS-Admin/MS-aom-agregator, qui publient encore en `amqp://`). MS-notifications se connecte par défaut en `amqps://rabbitmq:5671`.
- `ms-user-tls` (CN `ms-user`) : MS-User écoute en HTTPS sur 3444 en plus du HTTP 3001 (MS-Auth l'appelle encore en clair). `UserLookupService` se connecte par défaut en `https://ms-user:3444/graphql` (corrige au passage un ancien hostname `service-user` qui ne correspondait à aucun Service k8s réel).

Secrets et `NODE_EXTRA_CA_CERTS=/etc/tls/ca.pem` définis dans `k8s/00-rabbitmq-notifications.yaml`, `k8s/06-ms-user.yaml`, `k8s/03-ms-notifications.yaml`.
