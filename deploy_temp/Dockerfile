FROM node:20-alpine

WORKDIR /app

# Install system dependencies for Chromium (whatsapp-web.js support)
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
    alsa-lib \
    libstdc++ \
    libgcc

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    NODE_ENV=production \
    PORT=8080

# Install production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy local dist folder (pre-built)
COPY dist ./dist

# Copy env file (for secrets/config)
COPY .env ./

# Expose port
EXPOSE 8080

# Start server
CMD ["npm", "start"]
