# Build stage
FROM node:20-slim AS builder

WORKDIR /app

# Install build dependencies
# We need these to build the project
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Build frontend (Vite) and backend (esbuild)
# NODE_OPTIONS for memory intensive builds
RUN NODE_OPTIONS='--max-old-space-size=2048' npm run build

# Runtime stage
FROM node:20-slim

WORKDIR /app

# Environment defaults
ENV NODE_ENV=production
ENV PORT=5000

# Install production dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy built assets from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/drizzle.production.config.ts ./
COPY --from=builder /app/drizzle-migrations ./drizzle-migrations
COPY --from=builder /app/package.json ./

# Ensure the start script is executable
RUN chmod +x scripts/start-production.sh

# Expose the port Cloud Run expects (usually 8080, but we use PORT env var)
EXPOSE 5000

# Use the existing production start script
# This script handles DB schema sync and then starts node dist/index.js
CMD ["bash", "scripts/start-production.sh"]
