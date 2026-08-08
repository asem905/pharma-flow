FROM node:25-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev

COPY . .

USER node

# No HTTP server — this is a pure RabbitMQ consumer process
CMD ["node", "src/index.js"]
