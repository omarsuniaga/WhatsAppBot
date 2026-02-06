# =============================================================================
# WhatsApp Bot Platform - Multi-Stage Dockerfile
# =============================================================================
# Imagen unificada: Express sirve backend + frontend estático

# -----------------------------------------------------------------------------
# Stage 1: Builder - Compilar TypeScript y construir frontend
# -----------------------------------------------------------------------------
FROM node:18-alpine AS builder

RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copiar package files para cache de dependencias
COPY package*.json ./
COPY web/package*.json ./web/

# Instalar todas las dependencias (incluyendo devDependencies para build)
RUN npm ci --silent && cd web && npm ci --silent

# Copiar código fuente
COPY tsconfig.json ./
COPY src/ ./src/
COPY backend/src/ ./backend/src/
COPY web/ ./web/

# Compilar backend (TypeScript → lib/)
RUN npm run build

# Compilar frontend (React → web/dist/)
RUN cd web && npm run build

# -----------------------------------------------------------------------------
# Stage 2: Production - Imagen de runtime
# -----------------------------------------------------------------------------
FROM node:18-alpine

RUN apk add --no-cache ffmpeg tini curl && rm -rf /var/cache/apk/*

WORKDIR /app

# Instalar solo dependencias de producción
COPY package*.json ./
RUN npm ci --omit=dev --silent && npm cache clean --force

# Copiar artefactos compilados del builder
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/web/dist ./web/dist

# Crear directorios para volúmenes
RUN mkdir -p ./web-bot_sessions ./data ./backend/data

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]

CMD ["node", "lib/server/index.js"]
