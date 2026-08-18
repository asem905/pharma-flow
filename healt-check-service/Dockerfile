FROM node:25-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev

COPY . .

USER node

# Pure polling process — no HTTP server
CMD ["node", "src/index.js"]
