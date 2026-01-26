# Server - API REST + WebSocket

## Arquitectura

```
server/
├── index.ts              # Entry point del servidor Express
├── controllers/          # Handlers de endpoints
├── services/             # Logica de negocio
├── middlewares/          # Rate limiting, validacion
├── routes/               # Definicion de rutas
└── types/                # TypeScript interfaces
```

## Endpoints Disponibles

### Status y Autenticacion
| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/api/status` | Estado de conexion |
| GET | `/api/status/qr` | Obtener QR actual |
| POST | `/api/auth/logout` | Cerrar sesion |

### Chats
| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/api/chats` | Lista de chats |
| GET | `/api/chats/:jid/messages` | Mensajes de un chat |
| POST | `/api/chats/:jid/bot-toggle` | Activar/desactivar bot |

### Mensajes
| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| POST | `/api/messages/text` | Enviar texto |
| POST | `/api/messages/media` | Enviar imagen/video |
| POST | `/api/messages/file` | Enviar archivo |
| POST | `/api/messages/location` | Enviar ubicacion |
| POST | `/api/messages/contact` | Enviar contacto |
| POST | `/api/messages/poll` | Crear encuesta |
| POST | `/api/messages/sticker` | Enviar sticker |

### Rate Limiting
| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/api/rate-limit/status` | Estado actual |
| GET | `/api/rate-limit/stats` | Estadisticas |
| POST | `/api/rate-limit/reset` | Resetear limites |
| POST | `/api/rate-limit/clear-block` | Quitar bloqueo |

### Message Queue
| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/api/queue/status` | Estado de la cola |
| GET | `/api/queue/message/:id` | Obtener mensaje |
| DELETE | `/api/queue/message/:id` | Cancelar mensaje |
| DELETE | `/api/queue/clear` | Limpiar cola |

### Contact Groups (Grupos Locales)
| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/api/contact-groups` | Lista de grupos |
| POST | `/api/contact-groups` | Crear grupo |
| PUT | `/api/contact-groups/:id` | Actualizar grupo |
| DELETE | `/api/contact-groups/:id` | Eliminar grupo |
| POST | `/api/contact-groups/:id/contacts` | Agregar contactos |
| POST | `/api/contact-groups/:id/send` | Envio masivo |

### WhatsApp Groups (Grupos Reales)
| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/api/wa-groups` | Lista de grupos WA |
| POST | `/api/wa-groups` | Crear grupo WA |
| GET | `/api/wa-groups/:jid` | Metadata del grupo |
| POST | `/api/wa-groups/:jid/participants` | Gestionar participantes |
| GET | `/api/wa-groups/:jid/invite` | Obtener link de invitacion |

### Bot Intelligence
| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/api/bot/config` | Configuracion del bot |
| PUT | `/api/bot/config` | Actualizar configuracion |
| POST | `/api/bot/test` | Probar respuesta |
| GET | `/api/bot/knowledge` | Base de conocimiento |
| POST | `/api/bot/knowledge/category` | Crear categoria |
| POST | `/api/bot/knowledge/question` | Crear pregunta |

## WebSocket Events

### Emitidos por el servidor
- `qr` - Nuevo codigo QR
- `connection:status` - Cambio de estado
- `ready` - Conexion establecida
- `message:new` - Nuevo mensaje recibido
- `bot:response` - Respuesta del bot enviada

## Rate Limiting

El sistema implementa rate limiting conservador:
- **30 mensajes por minuto** para mensajes individuales
- **1-3 segundos** de delay aleatorio entre mensajes
- **Bloqueo de 5 minutos** tras 3 advertencias
- **Grupos y broadcasts** estan exentos del limite
