FROM node:20-alpine

# Install curl for health checks
RUN apk add --no-cache curl

WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./

# Install production dependencies
RUN npm install --production

# Copy source code
COPY . .

# Expose standard port
EXPOSE 8000

# Health check to ensure the container is ready
HEALTHCHECK --interval=60s --timeout=10s --start-period=10s --retries=5 \
  CMD curl -f http://localhost:8000/ || exit 1

# Start Express server
CMD ["node", "server.js"]
