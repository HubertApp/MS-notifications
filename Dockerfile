FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci --ignore-scripts

COPY . .

RUN npm run build

EXPOSE 3001

USER node

CMD ["npm", "run", "start:prod"]