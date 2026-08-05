// Outil MANUEL de test de charge HTTP réel, à lancer contre une instance de
// MS-notifications qui tourne vraiment (local, docker-compose, Minikube...).
// Contrairement à test/performance/*.perf-spec.ts (déterministe, tout mocké,
// exécuté en CI), ce script tape sur de vraies requêtes GraphQL et mesure le
// débit/latence réels — y compris Mongo, réseau, etc.
//
// Usage :
//   MS_NOTIFICATIONS_URL=http://localhost:3001/graphql \
//   LOAD_TEST_USER_ID=user-load-test \
//   npm run test:load
//
// Nécessite que le service tourne et que la base soit accessible.
import autocannon from 'autocannon';

const url = process.env.MS_NOTIFICATIONS_URL || 'http://localhost:3001/graphql';
const userId = process.env.LOAD_TEST_USER_ID || 'user-load-test';
const durationSeconds = Number(process.env.LOAD_TEST_DURATION_S || 15);
const connections = Number(process.env.LOAD_TEST_CONNECTIONS || 20);

const query = {
  query: 'query GetAllNotifications { getAllNotifications { id content type createdAt } }',
};

console.log(`Cible : ${url}`);
console.log(`Durée : ${durationSeconds}s, connexions simultanées : ${connections}`);
console.log('---');

const instance = autocannon(
  {
    url,
    method: 'POST',
    connections,
    duration: durationSeconds,
    headers: {
      'content-type': 'application/json',
      // Mêmes headers de confiance que FederatedAuthGuard attend en
      // interne (voir federated-auth.guard.ts) — en production, c'est le
      // routeur/gateway qui les pose après avoir vérifié un vrai token.
      'x-user-id': userId,
      'x-auth-state': 'VALID',
      'x-user-role': 'USER',
    },
    body: JSON.stringify(query),
  },
  (err, result) => {
    if (err) {
      console.error('Erreur pendant le test de charge :', err);
      process.exit(1);
    }
  },
);

autocannon.track(instance, { renderProgressBar: true });

process.once('SIGINT', () => {
  instance.stop();
});
