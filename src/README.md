# WhatsApp Bot - Source Code

## Estructura del Proyecto

```
src/
├── baileys.ts          # Cliente principal de WhatsApp (BaileysClass)
├── utils.ts            # Utilidades generales
├── agents/             # Agentes de IA para respuestas inteligentes
└── server/             # API REST + WebSocket
```

## Componentes Principales

### BaileysClass (`baileys.ts`)
Cliente de WhatsApp que maneja:
- Conexion y autenticacion (QR o pairing code)
- Envio de mensajes (texto, media, archivos, ubicacion, contacto, encuestas, stickers)
- Store de mensajes en memoria
- Eventos de conexion y mensajes

### Server (`server/`)
API REST y WebSocket para interfaz web:
- **Controllers**: Endpoints para chats, mensajes, grupos, bot
- **Services**: Logica de negocio (rate limiting, queue, grupos)
- **Middlewares**: Rate limiting, validacion

### Agents (`agents/`)
Sistema de bot inteligente:
- **DecisionAgent**: Controla que chats tienen bot activo
- **QASearchAgent**: Busqueda en base de conocimiento local
- **GeminiAgent**: Integracion con Gemini AI
- **BotOrchestrator**: Orquestador del flujo de respuestas

## Flujo de Datos

```
Mensaje WhatsApp
       │
       ▼
┌─────────────────┐
│  BaileysClass   │─────────▶ Socket.io ─────▶ Frontend
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  BotOrchestrator│
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌───────┐ ┌───────┐
│  Q&A  │ │Gemini │
│Search │ │  AI   │
└───────┘ └───────┘
```

## Inicio Rapido

```bash
# Desarrollo
npm run server:dev

# Produccion
npm run build
npm run server
```

## Variables de Entorno

```env
GEMINI_API_KEY=tu_api_key_de_gemini
PORT=3001
```
