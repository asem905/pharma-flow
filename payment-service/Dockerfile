FROM node:25-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev

COPY prisma ./prisma/

RUN npx prisma generate

COPY . .

USER node

EXPOSE 3005

CMD ["node", "src/server.js"]
