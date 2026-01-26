# Controllers

Handlers de endpoints REST del servidor.

## Controllers Disponibles

### statusController
**Archivo**: `statusController.ts`

Estado de conexion y autenticacion.

| Endpoint | Metodo | Descripcion |
|----------|--------|-------------|
| `/status` | GET | Estado de conexion (connected/disconnected) |
| `/status/qr` | GET | Codigo QR actual para escanear |
| `/auth/logout` | POST | Cerrar sesion de WhatsApp |

### chatController
**Archivo**: `chatController.ts`

Gestion de chats y mensajes.

| Endpoint | Metodo | Descripcion |
|----------|--------|-------------|
| `/chats` | GET | Lista de chats con ultimo mensaje, fotos |
| `/chats/:jid/messages` | GET | Mensajes de un chat (con info sender en grupos) |
| `/chats/:jid/bot-toggle` | POST | Activar/desactivar bot para chat |

### messageController
**Archivo**: `messageController.ts`

Envio de mensajes (con rate limiting).

| Endpoint | Metodo | Body |
|----------|--------|------|
| `/messages/text` | POST | `{ number, message }` |
| `/messages/media` | POST | `{ number, mediaUrl, caption }` |
| `/messages/file` | POST | `{ number, fileUrl }` |
| `/messages/location` | POST | `{ number, latitude, longitude }` |
| `/messages/contact` | POST | `{ number, contactNumber, displayName }` |
| `/messages/poll` | POST | `{ number, question, options[] }` |
| `/messages/sticker` | POST | `{ number, stickerUrl }` |

### contactGroupController
**Archivo**: `contactGroupController.ts`

Grupos de contactos locales (etiquetas/tags).

| Endpoint | Metodo | Descripcion |
|----------|--------|-------------|
| `/contact-groups` | GET | Lista de grupos |
| `/contact-groups` | POST | Crear grupo `{ name, description, color }` |
| `/contact-groups/:id` | PUT | Actualizar grupo |
| `/contact-groups/:id` | DELETE | Eliminar grupo |
| `/contact-groups/:id/contacts` | POST | Agregar contactos `{ contacts: [{jid, name}] }` |
| `/contact-groups/:id/send` | POST | Envio masivo `{ type, content }` |

### whatsappGroupController
**Archivo**: `whatsappGroupController.ts`

Grupos reales de WhatsApp.

| Endpoint | Metodo | Descripcion |
|----------|--------|-------------|
| `/wa-groups` | GET | Lista de grupos WA |
| `/wa-groups` | POST | Crear grupo `{ name, participants[] }` |
| `/wa-groups/:jid` | GET | Metadata del grupo |
| `/wa-groups/:jid/participants` | POST | Gestionar `{ action: 'add'|'remove', participants[] }` |
| `/wa-groups/:jid/invite` | GET | Link de invitacion |
| `/wa-groups/join` | POST | Unirse via codigo `{ inviteCode }` |

### botController
**Archivo**: `botController.ts`

Configuracion del bot inteligente.

| Endpoint | Metodo | Descripcion |
|----------|--------|-------------|
| `/bot/config` | GET | Configuracion actual |
| `/bot/config` | PUT | Actualizar config `{ geminiApiKey, settings }` |
| `/bot/toggle/:jid` | POST | Toggle bot `{ active }` |
| `/bot/test` | POST | Probar respuesta `{ message }` |
| `/bot/knowledge` | GET | Base de conocimiento completa |
| `/bot/knowledge/category` | POST | Crear categoria |
| `/bot/knowledge/question` | POST | Crear pregunta |

### aiController
**Archivo**: `aiController.ts`

Configuracion de IA (legacy, usar botController).

| Endpoint | Metodo | Descripcion |
|----------|--------|-------------|
| `/config/ai` | POST | Actualizar API key de Gemini |
