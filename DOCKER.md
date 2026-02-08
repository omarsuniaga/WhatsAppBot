# 🐳 Dockerización - WhatsApp Bot Platform

## 📋 Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Development](#development)
4. [Production](#production)
5. [Backup & Restore](#backup--restore)
6. [Monitoring](#monitoring)
7. [Troubleshooting](#troubleshooting)

---

## 🎯 Overview

La plataforma WhatsApp Bot está completamente dockerizada para facilitar el despliegue, escalabilidad y gestión. La implementación incluye:

- **Multi-stage builds** para imágenes optimizadas
- **Volumes persistentes** para datos críticos
- **Health checks** para monitoreo
- **Nginx reverse proxy** para producción
- **Redis cache** para performance
- **Automated backups** con scripts dedicados
- **Security hardening** con non-root users

---

## 🚀 Quick Start

### Prerequisitos

```bash
# Instalar Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Instalar Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### Inicio Rápido

```bash
# 1. Clonar el repositorio
git clone <repository-url>
cd whatsapp-bot-platform

# 2. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales

# 3. Iniciar desarrollo
chmod +x scripts/deploy.sh
./scripts/deploy.sh deploy development
```

---

## 🔧 Development

### Estructura de Directorios

```
project/
├── Dockerfile                 # Multi-stage build principal
├── docker-compose.yml         # Desarrollo
├── docker-compose.production.yml # Producción
├── .dockerignore             # Exclusiones Docker
├── nginx/                    # Configuración Nginx
│   ├── nginx.conf
│   └── default.conf
├── scripts/                  # Scripts de gestión
│   ├── deploy.sh
│   ├── backup.sh
│   └── restore.sh
├── data/                     # Datos persistentes
├── logs/                     # Logs de aplicación
└── backups/                  # Backups automáticos
```

### Servicios de Desarrollo

```bash
# Iniciar todos los servicios
docker compose up -d

# Ver logs
docker compose logs -f

# Iniciar con hot reload
docker compose up --build

# Iniciar solo backend
docker compose up -d app redis

# Iniciar frontend dev server
docker compose up -d frontend
```

### Volumes Importantes

- **`./web-bot_sessions`**: Sesiones WhatsApp (¡CRÍTICO!)
- **`./data`**: Knowledge Base, contacts, etc.
- **`./logs`**: Logs de aplicación
- **`./backups`**: Backups automáticos

---

## 🌐 Production

### Configuración Producción

```bash
# 1. Configurar environment producción
cp .env .env.production
# Editar con valores de producción

# 2. Preparar SSL certificates
mkdir -p nginx/ssl
# Copiar cert.pem y key.pem

# 3. Configurar secrets
mkdir -p secrets
echo "GEMINI_API_KEY" > secrets/gemini_api_key.txt
echo "ADMIN_API_KEY" > secrets/admin_api_key.txt

# 4. Desplegar producción
./scripts/deploy.sh deploy production
```

### Servicios Producción

El stack de producción incluye:

- **Nginx**: Reverse proxy + SSL termination
- **Backend**: WhatsApp Bot API
- **Frontend**: Servidor estático optimizado
- **Redis**: Cache y sesiones distribuidas
- **Monitoring** (opcional): Prometheus + Grafana
- **Logging** (opcional): ELK stack

### Health Checks

```bash
# Verificar estado de todos los servicios
docker compose -f docker-compose.production.yml ps

# Health checks específicos
curl http://localhost/health  # Nginx
curl http://localhost:3001/health  # Backend API
```

---

## 💾 Backup & Restore

### Backups Automatizados

```bash
# Ejecutar backup completo
./scripts/backup.sh

# Programar backups diarios (crontab)
0 2 * * * /path/to/project/scripts/backup.sh >> /var/log/backup.log 2>&1
```

### Tipos de Backup

El script backup crea:

1. **WhatsApp Sessions**: `whatsapp-sessions-YYYYMMDD_HHMMSS.tar.gz`
2. **App Data**: `app-data-YYYYMMDD_HHMMSS.tar.gz`
3. **Configuration**: `config-YYYYMMDD_HHMMSS.txt`
4. **Logs**: `logs-YYYYMMDD_HHMMSS.tar.gz`
5. **Redis**: `redis-dump-YYYYMMDD_HHMMSS.rdb`

### Restauración

```bash
# Listar backups disponibles
./scripts/restore.sh list

# Restaurar sesiones WhatsApp (más crítico)
./scripts/restore.sh sessions whatsapp-sessions-20240101_120000.tar.gz

# Restaurar datos de aplicación
./scripts/restore.sh data app-data-20240101_120000.tar.gz

# Restaurar Redis
./scripts/restore.sh redis redis-dump-20240101_120000.rdb
```

---

## 📊 Monitoring

### Prometheus + Grafana (Opcional)

```bash
# Iniciar con monitoring
docker compose -f docker-compose.production.yml --profile monitoring up -d

# Acceder a Grafana
http://localhost:3000
# Usuario: admin
# Contraseña: admin123 (cambiar en producción)
```

### Métricas Clave

- **Uptime del bot**
- **Mensajes procesados**
- **Tiempos de respuesta**
- **Uso de memoria/CPU**
- **Conexiones WebSocket**

### Logs Centralizados

```bash
# Iniciar ELK stack (opcional)
docker compose -f docker-compose.production.yml --profile logging up -d

# Acceder a Kibana
http://localhost:5601
```

---

## 🔧 Troubleshooting

### Problemas Comunes

#### 1. WhatsApp Sessions Corruptas

```bash
# Síntomas: Bot se desconecta constantemente
# Solución:
docker compose down
mv web-bot_sessions web-bot_sessions.backup
mkdir web-bot_sessions
docker compose up -d

# Volver a escanear QR code desde dashboard
```

#### 2. Permisos de Volumes

```bash
# Síntomas: Error permission denied en logs
# Solución:
sudo chown -R $USER:$USER ./data ./logs ./web-bot_sessions
chmod 755 ./data ./logs ./web-bot_sessions
```

#### 3. Puerto en Uso

```bash
# Síntomas: Error "port already in use"
# Solución:
sudo lsof -i :3001
sudo kill -9 <PID>
# O cambiar puerto en .env
```

#### 4. Memoria Insuficiente

```bash
# Síntemas: Container se reinicia constantemente
# Solución:
# Aumentar swap o límites de memoria
docker compose up -d --scale app=1
```

### Debug Commands

```bash
# Ver logs en tiempo real
docker compose logs -f app

# Entrar al container
docker compose exec app sh

# Ver consumo de recursos
docker stats

# Ver eventos de Docker
docker events --filter container=whatsapp-bot-platform
```

### Health Checks Detallados

```bash
# Health check del backend
curl -v http://localhost:3001/health

# Health check del frontend
curl -v http://localhost/

# Verificar WebSocket
wscat -c ws://localhost:3001/socket.io/
```

---

## 🔄 Ciclo de Vida del Despliegue

### Desarrollo → Staging → Producción

```bash
# 1. Desarrollo
git checkout develop
./scripts/deploy.sh deploy development

# 2. Testing en staging
git checkout staging
./scripts/deploy.sh deploy production  # Con config de staging

# 3. Backup previo a producción
./scripts/backup.sh

# 4. Despliegue producción
git checkout main
./scripts/deploy.sh deploy production

# 5. Verificación post-despliegue
curl http://localhost/health
curl http://localhost:3001/health
```

### Rollback Automático

```bash
# Si algo falla en producción
./scripts/deploy.sh rollback 20240101_120000

# O restaurar backup específico
./scripts/restore.sh sessions backups/whatsapp-sessions-20240101_120000.tar.gz
```

---

## 📚 Referencias Útiles

### Docker Commands

```bash
# Build optimizado
docker build --no-cache -t whatsapp-bot:latest .

# Limpiar imágenes no usadas
docker image prune -f

# Limpiar volumes no usados
docker volume prune -f

# Ver tamaño de imágenes
docker images --format "table {{.Repository}}\t{{.Size}}"

# Exportar/Importar imagenes
docker save -o whatsapp-bot.tar whatsapp-bot:latest
docker load -i whatsapp-bot.tar
```

### Performance Tuning

```yaml
# docker-compose.production.yml
deploy:
  resources:
    limits:
      cpus: '1.0'
      memory: 1G
    reservations:
      cpus: '0.5'
      memory: 512M
```

### Security Best Practices

```bash
# Usar non-root users
USER 1001:1001

# Readonly filesystem
VOLUME ["/app/data"]
WORKDIR /app

# Secrets management
secrets:
  gemini_api_key:
    file: ./secrets/gemini_api_key.txt
```

---

## 🆘 Soporte

### Logs Importantes para Debug

```bash
# Logs de inicialización del bot
docker compose logs app | grep "BotOrchestrator"

# Logs de conexión WhatsApp
docker compose logs app | grep -E "(qr|ready|connection)"

# Logs de errores críticos
docker compose logs app | grep -i error

# Logs de Redis
docker compose logs redis | grep -i error
```

### Variables de Entorno Clave

```bash
# .env.production
NODE_ENV=production
BOT_NAME=production-bot
GEMINI_API_KEY=your_gemini_key
ADMIN_API_KEY=your_admin_key
FRONTEND_URL=https://yourdomain.com
```

---

## ✅ Checklist Pre-Producción

- [ ] Configurar variables de entorno producción
- [ ] Preparar certificados SSL
- [ ] Crear secrets files
- [ ] Ejecutar backup completo
- [ ] Probar en staging primero
- [ ] Verificar health checks
- [ ] Configurar monitoreo
- [ ] Programar backups automáticos
- [ ] Documentar procedimientos de emergencia
- [ ] Test de rollback

---

**¡Listo para producción! 🎉**