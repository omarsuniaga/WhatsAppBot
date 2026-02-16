# 🚀 Docker Quick Start - WhatsApp Bot Platform

## ⚡ Inicio Inmediato (5 minutos)

### 1. Configuración Rápida

```bash
# Copiar configuración
cp .env .env.production

# Editar las siguientes variables en .env.production:
# GEMINI_API_KEY=tu_gemini_api_key
# ADMIN_API_KEY=tu_admin_key_seguro
# BOT_NAME=tu-nombre-bot
```

### 2. Iniciar Sistema

```bash
# Dar permisos a scripts
chmod +x scripts/*.sh

# Desplegar automáticamente
./scripts/deploy.sh deploy development
```

### 3. Acceder al Sistema

- **Dashboard**: http://localhost:5173
- **API Health**: http://localhost:3001/health
- **Redis CLI**: `docker exec -it whatsapp-bot-redis redis-cli`

### 4. Escanear QR WhatsApp

1. Abrir dashboard en navegador
2. Esperar código QR en terminal
3. Escanear con WhatsApp mobile
4. Listo para recibir mensajes!

---

## 🐛 Si algo falla...

### Puerto Ocupado
```bash
# Matar proceso en puerto 3001
sudo lsof -ti:3001 | xargs kill -9
```

### Permisos de Docker
```bash
# Añadir usuario a docker group
sudo usermod -aG docker $USER
# Logout y login nuevamente
```

### Ver Logs
```bash
# Logs del bot
docker compose logs -f app

# Logs de Redis
docker compose logs -f redis
```

---

## 📱 Primer Mensaje de Prueba

Una vez conectado WhatsApp:

1. Envía "hola" al número del bot
2. Revisa el dashboard para ver la respuesta
3. El bot responderá según configuración

---

**¿Necesitas ayuda completa?** 📖 [Ver Documentación Completa](DOCKER.md)