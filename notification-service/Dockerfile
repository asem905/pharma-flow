FROM node:25-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Use ci for clean, deterministic installs. Use --omit=dev to skip devDependencies.
RUN npm ci --omit=dev

# Copy application source
COPY . .

# Run as non-root user for better security
USER node

EXPOSE 3004

# Run node directly instead of npm to handle OS signals (like SIGTERM) properly
CMD ["node", "src/index.js"]
