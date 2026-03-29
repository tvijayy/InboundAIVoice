FROM node:18-alpine

WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./

# Install production dependencies
RUN npm install --production

# Copy source code
COPY . .

# Expose standard port
EXPOSE 8000

# Start Express server
CMD ["node", "server.js"]
