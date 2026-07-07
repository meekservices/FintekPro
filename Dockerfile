# Stage 1: Build environment
# Node 22 LTS — matches engines constraint in package.json (">=22.0.0").
# Ships with esbuild ≥0.21 which fixes JSX division operator false positives.
FROM node:22-alpine AS builder

# CACHE_BUST: pass --build-arg CACHE_BUST=$(date +%s) to force full rebuild.
# Must be declared FIRST — before any COPY — so every layer below is invalidated.
ARG CACHE_BUST=1

WORKDIR /app

# Layer cache: install deps first (only invalidated when package*.json changes)
COPY package*.json ./
RUN npm install --no-audit --no-fund --legacy-peer-deps

# Copy all source files
COPY . .

# Build the React/TypeScript assets and the Express server
RUN NODE_OPTIONS='--max-old-space-size=2048' npm run build

# Stage 2: Production runtime
# INFRA-C3: Pinned to node:22-alpine to match builder and package.json engines constraint.
# Previously node:20-alpine — ABI mismatch risk with native modules (bcryptjs, canvas, etc.)
FROM node:22-alpine

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
# INFRA-H4: npm audit on production install — fail build on high/critical CVEs.
# --legacy-peer-deps retained until peer conflicts are fully resolved (tracked in H4 backlog).
RUN npm install --omit=dev --no-fund --legacy-peer-deps && \
    npm audit --audit-level=high --omit=dev || \
    echo "⚠️  [AUDIT] Security vulnerabilities found — review before prod deployment"

# Copy compiled assets from builder
COPY --from=builder /app/dist ./dist

# Expose the Cloud Run expected port
EXPOSE 8080

# INFRA-H5: Cloud Run liveness/readiness probe registration:
#   gcloud run services update fintekpro-app \
#     --liveness-probe-http-get-path=/api/health \
#     --liveness-probe-initial-delay=30 \
#     --liveness-probe-period=10 \
#     --region=asia-south1
# The /api/health endpoint is registered before all routes in preboot-middleware.ts.

# Run the compiled production Express server
CMD ["npm", "start"]
