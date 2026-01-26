# Services

Servicios de logica de negocio del servidor.

## Servicios Disponibles

### BotService
**Archivo**: `botService.ts`

Singleton que encapsula BaileysClass y maneja:
- Conexion con WhatsApp
- Envio de mensajes
- Gestion de grupos WhatsApp
- Integracion con BotOrchestrator

```typescript
const service = BotService.getInstance();
await service.initialize({ name: 'mi-bot' });
await service.sendText(jid, 'Hola!');
```

### RateLimitService
**Archivo**: `rateLimitService.ts`

Control de tasa de mensajes para evitar bloqueos:
- 30 mensajes/minuto maximo
- Delays aleatorios 1-3 segundos
- Deteccion de patrones sospechosos
- Bloqueo temporal automatico

```typescript
const service = RateLimitService.getInstance();
const status = service.canSendIndividual();
// { canSend: true, messagesRemaining: 25, resetIn: 45000 }
```

### MessageQueueService
**Archivo**: `messageQueueService.ts`

Cola de mensajes con:
- Prioridades
- Reintentos automaticos
- Backoff exponencial
- Historial de procesados

```typescript
const service = MessageQueueService.getInstance();
service.enqueue('text', jid, { message: 'Hola' }, { priority: 1 });
service.enqueueBulk('text', jids, { message: 'Hola a todos' });
```

### ContactGroupService
**Archivo**: `contactGroupService.ts`

Gestion de grupos de contactos locales (tags/etiquetas):
- CRUD de grupos
- Agregar/quitar contactos
- Envio masivo a grupo

```typescript
const service = ContactGroupService.getInstance();
const group = service.createGroup('VIP', 'Clientes importantes', '#FF0000');
service.addContacts(group.id, [{ jid, name }]);
```

### ProfileCacheService
**Archivo**: `profileCacheService.ts`

Cache de fotos de perfil:
- TTL de 1 hora
- Evita llamadas repetidas
- Soporte para multiples JIDs

```typescript
const service = ProfileCacheService.getInstance();
const url = await service.getProfilePicUrl(jid);
const urls = await service.getMultipleProfilePics(jids);
```

## Persistencia

Todos los servicios que manejan datos persistentes usan archivos JSON en `data/`:
- `data/contact-groups.json` - Grupos de contactos
- `data/rate-limits.json` - Estado de rate limiting
- `data/message-queue.json` - Cola de mensajes
- `data/knowledge-base.json` - Base de conocimiento Q&A
- `data/bot-config.json` - Configuracion del bot
