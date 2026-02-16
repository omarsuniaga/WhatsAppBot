# Guía de Deployment - Sistema Administrativo de Guillermo

## 📋 Pre-requisitos

### Entorno Local
- Node.js v18+ instalado
- npm v9+ instalado
- Cuenta de Firebase activa
- Credenciales de Firebase Admin SDK

### Variables de Entorno

Crear archivo `.env` con las siguientes variables:

```env
# Firebase Configuration
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY=your-private-key
FIREBASE_CLIENT_EMAIL=your-client-email

# Server Configuration
PORT=3001
NODE_ENV=production

# WhatsApp Bot (Baileys)
BAILEYS_SESSION_PATH=./web-bot_sessions

# Optional: Analytics
ENABLE_ANALYTICS=true
LOG_LEVEL=info
```

---

## 🧪 Testing

### Ejecutar Tests Unitarios

```bash
npm test
```

### Ejecutar Tests con Coverage

```bash
npm run test:coverage
```

### Verificar Coverage Mínimo

El proyecto debe mantener **>80% coverage** en los servicios críticos:
- `dataService.ts`
- `analyticsService.ts`
- `automationService.ts`

---

## 🏗️ Build del Proyecto

### 1. Backend (TypeScript → JavaScript)

```bash
npm run build
```

Esto compila todo el código TypeScript a JavaScript en la carpeta `lib/`.

**Verificar build:**
```bash
ls lib/server/services/
# Debe mostrar: dataService.js, analyticsService.js, automationService.js
```

### 2. Frontend (React → Static Assets)

```bash
npm run web:build
```

Esto genera los assets estáticos del frontend en `web/dist/`.

**Verificar build:**
```bash
ls web/dist/
# Debe mostrar: index.html, assets/
```

---

## 🚀 Deployment Options

### Opción 1: Servidor VPS (Recomendado)

#### Paso 1: Preparar el Servidor

```bash
# En el servidor (Ubuntu/Debian)
sudo apt update
sudo apt install -y nodejs npm nginx pm2

# Clonar repositorio
git clone <your-repo-url>
cd bot-wa-baileys
```

#### Paso 2: Instalar Dependencias

```bash
# Backend
npm install --production

# Frontend
npm run web:install
```

#### Paso 3: Configurar Variables de Entorno

```bash
# Copiar ejemplo
cp .env.example .env

# Editar con credenciales reales
nano .env
```

#### Paso 4: Build

```bash
npm run build
npm run web:build
```

#### Paso 5: Configurar PM2 (Process Manager)

```bash
# Crear ecosystem file
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'admin-system-api',
    script: 'lib/server/index.js',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    }
  }]
}
EOF

# Iniciar con PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

#### Paso 6: Configurar Nginx (Reverse Proxy)

```bash
# Crear configuración Nginx
sudo nano /etc/nginx/sites-available/admin-system
```

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Frontend (React SPA)
    location / {
        root /path/to/bot-wa-baileys/web/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket for Socket.IO
    location /socket.io {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

```bash
# Habilitar sitio
sudo ln -s /etc/nginx/sites-available/admin-system /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### Paso 7: SSL con Certbot (Opcional pero Recomendado)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

---

### Opción 2: Firebase Hosting + Cloud Functions

#### Paso 1: Instalar Firebase CLI

```bash
npm install -g firebase-tools
firebase login
```

#### Paso 2: Inicializar Firebase

```bash
firebase init

# Seleccionar:
# - Hosting
# - Functions (Node.js)
# - Firestore (ya configurado)
```

#### Paso 3: Configurar `firebase.json`

```json
{
  "hosting": {
    "public": "web/dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      {
        "source": "/api/**",
        "function": "api"
      },
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  },
  "functions": {
    "source": "functions",
    "runtime": "nodejs18"
  }
}
```

#### Paso 4: Adaptar Backend para Cloud Functions

Crear `functions/index.ts`:

```typescript
import * as functions from 'firebase-functions';
import express from 'express';
import apiRoutes from '../src/server/routes/api';

const app = express();
app.use('/api', apiRoutes);

export const api = functions.https.onRequest(app);
```

#### Paso 5: Deploy

```bash
# Build frontend
npm run web:build

# Deploy
firebase deploy
```

---

### Opción 3: Docker Container

#### Paso 1: Crear `Dockerfile`

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY web/package*.json ./web/

# Install dependencies
RUN npm install --production
RUN cd web && npm install --production

# Copy source
COPY . .

# Build
RUN npm run build
RUN npm run web:build

# Expose ports
EXPOSE 3001

# Start
CMD ["node", "lib/server/index.js"]
```

#### Paso 2: Crear `docker-compose.yml`

```yaml
version: '3.8'

services:
  admin-system:
    build: .
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - PORT=3001
    env_file:
      - .env
    volumes:
      - ./web-bot_sessions:/app/web-bot_sessions
    restart: unless-stopped
```

#### Paso 3: Deploy con Docker

```bash
# Build
docker-compose build

# Start
docker-compose up -d

# Verificar logs
docker-compose logs -f
```

---

## 📊 Monitoreo y Logs

### PM2 Logs (VPS)

```bash
# Ver logs en tiempo real
pm2 logs admin-system-api

# Ver métricas
pm2 monit

# Ver status
pm2 status
```

### Firebase Logs (Cloud Functions)

```bash
firebase functions:log
```

### Docker Logs

```bash
docker-compose logs -f
```

---

## 🔐 Seguridad

### 1. Firewall Rules

```bash
# Permitir solo puertos necesarios
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS
sudo ufw enable
```

### 2. Environment Variables

**NUNCA** commitear `.env` al repositorio. Usar gestores de secretos en producción:

- **Firebase**: Firebase Config
- **AWS**: AWS Secrets Manager
- **Heroku**: Config Vars
- **Docker**: Docker Secrets

### 3. Rate Limiting

Implementar en `src/server/routes/index.ts`:

```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100 // 100 requests por IP
});

app.use('/api', limiter);
```

### 4. CORS Configuration

```typescript
import cors from 'cors';

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true
}));
```

---

## ✅ Post-Deployment Checklist

- [ ] Verificar que el servidor está corriendo (`pm2 status` o `docker ps`)
- [ ] Verificar que Nginx está sirviendo el frontend (abrir en navegador)
- [ ] Probar endpoints API:
  - `GET /api/data/students`
  - `GET /api/analytics/day/<today>`
- [ ] Verificar logs por errores
- [ ] Configurar backups de Firestore
- [ ] Configurar alertas de monitoreo
- [ ] Documentar URLs de producción
- [ ] Notificar al equipo

---

## 🔄 Actualización en Producción

### Pull Changes

```bash
git pull origin main
```

### Rebuild & Reload

```bash
# Build nuevo código
npm run build
npm run web:build

# Recargar PM2 (sin downtime)
pm2 reload admin-system-api

# O con Docker
docker-compose up -d --build
```

### Rollback en Caso de Error

```bash
# Git
git revert HEAD
npm run build
pm2 reload admin-system-api

# Docker
docker-compose down
git checkout <previous-commit>
docker-compose up -d --build
```

---

## 📞 Soporte

En caso de problemas en producción:

1. Revisar logs: `pm2 logs` o `docker-compose logs`
2. Verificar variables de entorno
3. Verificar conectividad a Firestore
4. Revisar uso de recursos: `pm2 monit` o `docker stats`
5. Contactar al equipo de desarrollo

---

## 🎯 Métricas de Éxito

- **Uptime**: >99.5%
- **Response Time API**: <200ms
- **Error Rate**: <1%
- **Test Coverage**: >80%
- **Page Load Time**: <2s

---

**Última actualización**: 2026-01-29
