# Guía Docker - WhatsApp Bot Platform

## Requisitos

- Docker Desktop instalado y **abierto** (el ícono debe estar en la barra de tareas)

---

## Comandos principales

### Construir la imagen
```bash
docker compose build
```

### Levantar la aplicación
```bash
docker compose up
```
La app estará disponible en `http://localhost:3001`

### Construir y levantar en un solo paso
```bash
docker compose up --build
```

### Levantar en segundo plano (sin bloquear la terminal)
```bash
docker compose up -d
```

### Ver logs cuando corre en segundo plano
```bash
docker compose logs -f
```

### Detener la aplicación
```bash
docker compose down
```

---

## Cuando editas archivos

### Flujo rápido (desarrollo local, sin Docker)
```bash
npm run dev
```
Esto levanta backend + frontend con recarga automática. No necesitas Docker para desarrollar.

### Flujo con Docker (probar como producción)

1. **Edita tus archivos** normalmente (código, configuración, etc.)
2. **Reconstruye y levanta**:
   ```bash
   docker compose up --build
   ```
   Esto reconstruye la imagen con tus cambios y levanta el contenedor.

3. **Verifica** en `http://localhost:3001`

> `--build` le dice a Docker que reconstruya la imagen antes de levantar. Sin esta flag, Docker usa la imagen anterior (sin tus cambios).

---

## Archivos importantes

| Archivo | Qué hace | Se monta como volumen? |
|---------|----------|----------------------|
| `src/**` | Código backend (TypeScript) | No - se compila en la imagen |
| `backend/src/**` | Módulos backend adicionales | No - se compila en la imagen |
| `web/src/**` | Código frontend (React) | No - se compila en la imagen |
| `data/` | Datos de la app (JSON) | Sí - persiste entre reinicios |
| `backend/data/` | Datos institucionales | Sí - persiste entre reinicios |
| `web-bot_sessions/` | Sesión de WhatsApp | Sí - persiste entre reinicios |
| `.env` | Variables de entorno | Sí - se lee al iniciar |

### Qué significa esto?

- **Archivos de código** (`src/`, `web/src/`, `backend/src/`): Necesitas `docker compose up --build` para que los cambios se apliquen.
- **Archivos de datos** (`data/`, `backend/data/`): Los cambios se ven inmediatamente porque están montados como volúmenes.
- **`.env`**: Cambios se aplican al reiniciar: `docker compose down && docker compose up`

---

## Resumen rápido

```
Editaste código?          → docker compose up --build
Editaste .env?            → docker compose down && docker compose up
Editaste datos en data/?  → No necesitas hacer nada
Solo quieres desarrollar? → npm run dev (sin Docker)
```

---

## Producción con Nginx

```bash
docker compose -f docker-compose.production.yml up --build -d
```

Requiere configurar `nginx/nginx.conf` y opcionalmente certificados SSL en `nginx/ssl/`.
