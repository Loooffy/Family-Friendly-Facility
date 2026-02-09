FROM node:20-alpine

WORKDIR /app

# Build arguments for environment variables (if needed at build time)
ARG VITE_HASURA_GRAPHQL_URL
ARG VITE_MAPBOX_TOKEN
ARG MAPBOX_TOKEN

# Set as environment variables
ENV VITE_HASURA_GRAPHQL_URL=${VITE_HASURA_GRAPHQL_URL}
ENV VITE_MAPBOX_TOKEN=${VITE_MAPBOX_TOKEN}
ENV MAPBOX_TOKEN=${MAPBOX_TOKEN}

# Copy package files
COPY package.json ./
COPY package-lock.json* ./

# Install dependencies
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# Copy source code
COPY . .

# Expose port
EXPOSE 3000

# Default command (will be overridden by docker-compose)
CMD ["npm", "run", "dev"]
