# 1. On part d'une image Node.js légère
FROM node:18-alpine

# 2. On crée le dossier de travail dans le conteneur
WORKDIR /app

# 3. On copie les fichiers de définition des dépendances
COPY package*.json ./

# 4. On installe les dépendances
RUN npm install

# 5. On copie tout le code source
COPY . .

# 6. On construit l'application (NestJS build)
RUN npm run build

# 7. On expose le port (pour info)
EXPOSE 3001

# 8. La commande de démarrage
CMD ["npm", "run", "start:prod"]