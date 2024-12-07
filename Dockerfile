FROM node:18

WORKDIR /app

# Install MongoDB and supervisor
RUN apt-get update && apt-get install -y wget gnupg supervisor && \
    wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | apt-key add - && \
    echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/6.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-6.0.list && \
    apt-get update && \
    apt-get install -y mongodb-org && \
    mkdir -p /data/db

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy and build TypeScript files
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Copy supervisor configuration
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Expose ports
EXPOSE 4000 27017

# Start services using supervisor
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]