# Stage 1: Build environment
FROM node:20-alpine AS builder

WORKDIR /app

# Layer cache the package.json and install dependencies
COPY package*.json ./
RUN npm ci

# Copy all source files
COPY . .

# Build the React/TypeScript assets and the Express server
RUN NODE_OPTIONS='--max-old-space-size=2048' npm run build

# Stage 2: Production runtime
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Layer cache production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled assets from builder
COPY --from=builder /app/dist ./dist

# Expose the Cloud Run expected port
EXPOSE 8080

# Run the compiled production Express server
CMD ["npm", "start"]
