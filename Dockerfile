# Stage 1: Build environment
FROM node:20-alpine AS builder

WORKDIR /app

# Layer cache the package.json and install dependencies
COPY package*.json ./
RUN npm install --no-audit --no-fund --legacy-peer-deps

# Copy all source files
COPY . .

# Build the React/TypeScript assets and the Express server
RUN NODE_OPTIONS='--max-old-space-size=2048' npm run build

# Stage 2: Production runtime
FROM node:20-alpine

WORKDIR /app

# ─── Chromium for WhatsApp (whatsapp-web.js / Puppeteer) ───────────────────────
# Alpine's Chromium package pulls in all required shared libraries
# (NSS, ATK, libX11, cairo, pango, etc.) in one step.
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    font-noto-emoji \
    dbus \
    udev \
    # Audio/video stubs required by Chromium sandbox
    alsa-lib \
    # Extra required .so files
    libstdc++ \
    libgcc

# Tell Puppeteer / whatsapp-web.js to skip downloading its own Chromium
# and point it at the system-installed binary instead
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    NODE_ENV=production \
    PORT=8080

# Layer cache production dependencies
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund --legacy-peer-deps

# Copy compiled assets from builder
COPY --from=builder /app/dist ./dist

# Expose the Cloud Run expected port
EXPOSE 8080

# Run the compiled production Express server
CMD ["npm", "start"]
