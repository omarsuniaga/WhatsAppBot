# Despliegue en VPS con Docker — Guía Completa

## Arquitectura de producción

```
Internet → [80/443] → Nginx (reverse proxy + SSL)
                          ↓ (red interna Docker)
                      WhatsApp Bot [:3001]
                          ├── Express API
                          ├── React SPA (static)
                          ├── Socket.IO (WebSocket)
                          └── Baileys (WhatsApp)
```

Solo Nginx está expuesto a internet. El backend vive en una red interna Docker.

## Requisitos del VPS

- Ubuntu 22.04+ (recomendado)
- 2GB RAM mínimo (1GB para Docker + bot, 1GB para OS)
- Docker Engine 24+ y Docker Compose v2+
- Dominio apuntando al VPS (para SSL)

## 1. Preparar el VPS

```bash
# Actualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Docker (oficial)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

# Instalar fail2ban (protección contra brute force SSH)
sudo apt install -y fail2ban
sudo systemctl enable fail2ban

# Configurar firewall — SOLO estos puertos
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# IMPORTANTE: NO abrir puerto 3001 — Nginx lo maneja internamente
# IMPORTANTE: NO abrir puerto 2375 — Docker API nunca debe ser pública
```

## 2. Subir el proyecto

```bash
# Opción A: Clonar desde Git
git clone https://github.com/omarsuniaga/WhatsAppBot.git /opt/whatsapp-bot
cd /opt/whatsapp-bot

# Opción B: rsync desde tu máquina local
rsync -avz --exclude node_modules --exclude lib --exclude web/dist \
  ./ usuario@TU_VPS_IP:/opt/whatsapp-bot/
```

## 3. Configurar secretos

```bash
cd /opt/whatsapp-bot

# Crear .env desde el template
cp .env.example .env
nano .env
```

Valores críticos a configurar en `.env`:
```env
# Tu dominio público (para CORS y Socket.IO)
FRONTEND_URL=https://tu-dominio.com

# Generar una key segura para admin
ADMIN_API_KEY=$(openssl rand -hex 32)

# API keys de AI
GROQ_API_KEY=gsk_...
GEMINI_API_KEY=AIza...

# Firebase (copiar de tu proyecto)
EXPO_PUBLIC_FIREBASE_API_KEY=...
```

Colocar el archivo de Firebase Admin SDK:
```bash
# Subir desde tu máquina local
scp orquestapuntacana-firebase-adminsdk-*.json usuario@TU_VPS:/opt/whatsapp-bot/
```

## 4. Despliegue inicial (sin SSL)

```bash
cd /opt/whatsapp-bot

# Construir y levantar
docker compose up -d --build

# Verificar que está corriendo
docker compose ps
docker compose logs -f whatsapp-bot

# Test de health
curl http://localhost/health
```

Abre `http://TU_VPS_IP` en el navegador. Deberías ver el dashboard.

## 5. Activar SSL con Certbot

```bash
# Obtener certificado SSL (asegúrate de que el dominio apunte al VPS)
docker compose run --rm certbot certonly \
  --webroot -w /var/www/certbot \
  -d tu-dominio.com \
  --email tu@email.com \
  --agree-tos \
  --no-eff-email

# Cambiar Nginx a la config con SSL
# Primero edita nginx/default.conf: reemplaza YOURDOMAIN con tu dominio real
sed -i 's/YOURDOMAIN/tu-dominio.com/g' nginx/default.conf

# Cambiar el volumen de nginx a usar default.conf (con SSL)
# En docker-compose.yml, cambiar:
#   ./nginx/default.no-ssl.conf → ./nginx/default.conf

# Reiniciar
docker compose up -d
```

Para auto-renovar SSL, agrega al crontab del VPS:
```bash
echo "0 3 * * * cd /opt/whatsapp-bot && docker compose run --rm certbot renew --quiet && docker compose exec nginx nginx -s reload" | sudo tee -a /var/spool/cron/crontabs/root
```

## 6. Verificación de seguridad

```bash
# El backend NO debe ser accesible directamente
curl http://TU_VPS_IP:3001/health   # Debe fallar (puerto cerrado)

# Solo a través de Nginx
curl http://TU_VPS_IP/health         # Debe responder {"status":"ok"}

# Verificar que el contenedor no corre como root
docker exec whatsapp-bot whoami      # Debe mostrar: appuser

# Verificar health del contenedor
docker inspect --format='{{.State.Health.Status}}' whatsapp-bot  # healthy
```

## Comandos de operación

```bash
# Ver logs en tiempo real
docker compose logs -f whatsapp-bot

# Reiniciar sin reconstruir
docker compose restart whatsapp-bot

# Actualizar código y reconstruir
cd /opt/whatsapp-bot
git pull
docker compose up -d --build

# Ver uso de recursos
docker stats

# Entrar al contenedor (debug)
docker compose exec whatsapp-bot sh
```

## Backups

Los datos críticos están en volúmenes Docker:

| Volumen | Contenido | Criticidad |
|---------|-----------|------------|
| `baileys_auth` | Sesión de WhatsApp (evita re-escanear QR) | Alta |
| `bot_data` | Knowledge base, config, alertas, contactos | Alta |
| `certbot_certs` | Certificados SSL | Media (se pueden regenerar) |

```bash
# Backup de datos del bot
docker run --rm \
  -v whatsapp-bot_bot_data:/data:ro \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/bot-data-$(date +%Y%m%d).tar.gz -C /data .

# Backup de sesión WhatsApp
docker run --rm \
  -v whatsapp-bot_baileys_auth:/data:ro \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/baileys-auth-$(date +%Y%m%d).tar.gz -C /data .

# Restaurar datos
docker compose down
docker run --rm \
  -v whatsapp-bot_bot_data:/data \
  -v $(pwd)/backups:/backup \
  alpine tar xzf /backup/bot-data-FECHA.tar.gz -C /data
docker compose up -d
```

Automatizar backup diario (añadir al crontab):
```bash
0 2 * * * cd /opt/whatsapp-bot && mkdir -p backups && \
  docker run --rm -v whatsapp-bot_bot_data:/d:ro -v $(pwd)/backups:/b alpine \
  tar czf /b/bot-data-$(date +\%Y\%m\%d).tar.gz -C /d . && \
  find backups/ -mtime +7 -delete
```

## Checklist pre-producción

- [ ] `.env` configurado con valores reales (no defaults)
- [ ] `ADMIN_API_KEY` cambiado del valor por defecto
- [ ] Firebase Admin SDK JSON presente en la raíz
- [ ] UFW activo con solo SSH, 80, 443
- [ ] Puerto 3001 NO accesible desde internet
- [ ] Contenedor corre como `appuser` (no root)
- [ ] SSL activo con certificado válido
- [ ] Backups automatizados
- [ ] fail2ban activo
- [ ] `FRONTEND_URL` apunta al dominio real con https
