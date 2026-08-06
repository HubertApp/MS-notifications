# 1. On part d'une image Node.js légère (18 est en fin de support, on passe en 20 LTS)
FROM node:20-alpine

# 2. On crée le dossier de travail dans le conteneur
WORKDIR /app

# 3. On copie les fichiers de définition des dépendances
COPY package*.json ./

# 4. npm ci (pas npm install) : installe strictement les versions du lockfile,
# reproductible, et échoue si package-lock.json est désynchronisé de package.json.
RUN npm ci

# 5. On copie tout le code source
COPY . .

# 6. On construit l'application (NestJS build)
RUN npm run build

# 7. On expose le port (pour info)
EXPOSE 3008

# Utilisateur non-root fourni par l'image node:alpine
USER node

# 8. La commande de démarrage — start:prod (pas start:dev, qui tourne en mode
# watch et n'est pas fait pour être exécuté dans un conteneur "figé")
CMD ["npm", "run", "start:prod"]