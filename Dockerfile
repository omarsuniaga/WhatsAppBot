# ============================================
# WhatsApp Bot Platform — Production Dockerfile
# Hardened: non-root, pinned versions, multi-stage
# ============================================

# ---- Stage 1: Build Frontend ----
FROM node:22.14-alpine3.21 AS frontend-builder

WORKDIR /build/web

COPY web/package.json web/package-lock.json* ./
RUN npm ci --ignore-scripts

COPY web/ ./
RUN npm run build

# ---- Stage 2: Build Backend ----
FROM node:22.14-alpine3.21 AS backend-builder

WORKDIR /build

COPY package.json package-lock.json* ./
RUN npm ci

COPY src/ ./src/
COPY backend/ ./backend/
COPY tsconfig.json ./

RUN npm run build

# ---- Stage 3: Production Image ----
FROM node:22.14-alpine3.21 AS production

# Install only runtime system deps, then clean apk cache
RUN apk add --no-cache ffmpeg wget \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# Create non-root user BEFORE copying files
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Install production deps only (as root, before switching user)
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --ignore-scripts \
    && npm cache clean --force \
    && rm -rf /tmp/* /root/.npm

# Copy compiled backend
COPY --from=backend-builder --chown=appuser:appgroup /build/lib ./lib

# Copy built frontend
COPY --from=frontend-builder --chown=appuser:appgroup /build/web/dist ./web/dist

# Copy default data files (will be overridden by volume in production)
COPY --chown=appuser:appgroup data/ ./data/

# Create writable directories for runtime (owned by appuser)
RUN mkdir -p /app/auth_info /app/logs \
    && chown -R appuser:appgroup /app/auth_info /app/logs /app/data

# Environment defaults (secrets come from .env / docker-compose, NEVER baked in)
ENV NODE_ENV=production
ENV PORT=3001

# Do NOT expose — reverse proxy handles public access
# EXPOSE is documentation only; actual port mapping is in docker-compose
EXPOSE 3001

# Health check (wget is lighter than curl on alpine)
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD wget -qO- http://localhost:3001/health || exit 1

# Drop to non-root user
USER appuser

CMD ["node", "lib/server/index.js"]
