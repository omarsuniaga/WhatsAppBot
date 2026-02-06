# Documentación Técnica - WhatsApp Bot Platform

> Última actualización: Enero 2026

## Índice

1. [Resumen del Sistema](#resumen-del-sistema)
2. [Arquitectura](#arquitectura)
3. [Backend](#backend)
4. [Frontend](#frontend)
5. [Sistema de Bot Inteligente](#sistema-de-bot-inteligente)
6. [APIs](#apis)
7. [Modelos de Datos](#modelos-de-datos)
8. [WebSocket Events](#websocket-events)
9. [Configuración](#configuración)
10. [Guía de Desarrollo](#guía-de-desarrollo)

---

## Resumen del Sistema

WhatsApp Bot Platform es una solución completa para gestionar comunicaciones de WhatsApp con capacidades de automatización inteligente. El sistema incluye:

- **Dashboard Web**: Interfaz moderna estilo WhatsApp Web
- **Bot Inteligente**: Respuestas automáticas con IA y base de conocimiento
- **Sistema de Alertas**: Escalación a humanos cuando el bot no puede responder
- **Aprendizaje Automático**: El bot aprende de las respuestas humanas
- **Configuración por Chat**: Personalización del comportamiento por conversación

### Stack Tecnológico

| Capa | Tecnología |
|------|------------|
| Runtime | Node.js 18+ |
| Lenguaje | TypeScript |
| Backend | Express.js |
| WebSocket | Socket.IO |
| Frontend | React 18 + Vite |
| Estado | Zustand |
| Estilos | TailwindCSS |
| WhatsApp | @whiskeysockets/baileys |
| IA | Google Gemini API |

---

## Arquitectura

### Diagrama General

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            CLIENTE (Browser)                             │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                         React Application                            ││
│  │  ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌────────────┐ ┌─────────┐ ││
│  │  │ ChatPage │ │  Admin   │ │  Alerts   │ │  Settings  │ │   Bot   │ ││
│  │  │          │ │Dashboard │ │   Panel   │ │   Panel    │ │ Config  │ ││
│  │  └──────────┘ └──────────┘ └───────────┘ └────────────┘ └─────────┘ ││
│  │                              │                                       ││
│  │                    ┌─────────┴─────────┐                             ││
│  │                    │   Zustand Store   │                             ││
│  │                    └─────────┬─────────┘                             ││
│  │                              │                                       ││
│  │                    ┌─────────┴─────────┐                             ││
│  │                    │    API Client     │                             ││
│  │                    └───────────────────┘                             ││
│  └─────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
                                  │
                     HTTP REST + WebSocket (Socket.IO)
                                  │
┌─────────────────────────────────────────────────────────────────────────┐
│                            SERVIDOR (Node.js)                            │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                         Express Server                               ││
│  │  ┌──────────────────────────────────────────────────────────────┐   ││
│  │  │                        API Routes                             │   ││
│  │  │  /api/chats  /api/alerts  /api/bot-assignments  /api/learning│   ││
│  │  └──────────────────────────────────────────────────────────────┘   ││
│  │                              │                                       ││
│  │  ┌──────────────────────────────────────────────────────────────┐   ││
│  │  │                       Controllers                             │   ││
│  │  │  chatController  alertController  botAssignmentController     │   ││
│  │  └──────────────────────────────────────────────────────────────┘   ││
│  │                              │                                       ││
│  │  ┌──────────────────────────────────────────────────────────────┐   ││
│  │  │                        Services                               │   ││
│  │  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐ │   ││
│  │  │  │   Chat      │ │    Bot      │ │      Knowledge          │ │   ││
│  │  │  │  Service    │ │  Service    │ │       Service           │ │   ││
│  │  │  └─────────────┘ └─────────────┘ └─────────────────────────┘ │   ││
│  │  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐ │   ││
│  │  │  │  Pending    │ │    Bot      │ │       Learning          │ │   ││
│  │  │  │AlertService │ │ Assignment  │ │       Service           │ │   ││
│  │  │  └─────────────┘ └─────────────┘ └─────────────────────────┘ │   ││
│  │  └──────────────────────────────────────────────────────────────┘   ││
│  │                              │                                       ││
│  │  ┌──────────────────────────────────────────────────────────────┐   ││
│  │  │                    BotOrchestrator                            │   ││
│  │  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐ │   ││
│  │  │  │  QASearch   │ │   Gemini    │ │      Decision           │ │   ││
│  │  │  │   Agent     │ │   Agent     │ │       Agent             │ │   ││
│  │  │  └─────────────┘ └─────────────┘ └─────────────────────────┘ │   ││
│  │  └──────────────────────────────────────────────────────────────┘   ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                              │                                           │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                      BaileysClass                                 │   │
│  │              (WhatsApp Multi-Device API)                          │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
                          WhatsApp Servers
```

### Flujo de Datos

```
Usuario WhatsApp → Baileys → BotService → BotOrchestrator
                                              │
                    ┌─────────────────────────┼─────────────────────────┐
                    │                         │                         │
                    ▼                         ▼                         ▼
              QASearchAgent            GeminiAgent              AlertService
              (Base de conocimiento)   (IA generativa)         (Escalación)
                    │                         │                         │
                    └─────────────────────────┼─────────────────────────┘
                                              │
                                              ▼
                                         Respuesta
                                              │
                    ┌─────────────────────────┼─────────────────────────┐
                    │                         │                         │
                    ▼                         ▼                         ▼
              WhatsApp                   Dashboard                 Learning
              (via Baileys)              (via Socket.IO)          (persistir)
```

---

## Backend

### Estructura de Archivos

```
src/
├── server/
│   ├── index.ts                 # Entry point del servidor
│   ├── routes/
│   │   └── index.ts             # Definición de rutas API
│   ├── controllers/
│   │   ├── chatController.ts    # Gestión de chats y mensajes
│   │   ├── alertController.ts   # Sistema de alertas
│   │   ├── botAssignmentController.ts  # Config por chat
│   │   └── learningController.ts       # Sistema de aprendizaje
│   └── services/
│       ├── chatService.ts       # Lógica de chats
│       ├── botService.ts        # Integración bot + Baileys
│       ├── knowledgeService.ts  # Base de conocimiento
│       ├── pendingAlertService.ts     # Alertas de escalación
│       ├── botAssignmentService.ts    # Configuración por chat
│       └── learningService.ts         # Aprendizaje automático
├── agents/
│   ├── BotOrchestrator.ts       # Orquestador principal
│   ├── QASearchAgent.ts         # Búsqueda en base de conocimiento
│   ├── GeminiAgent.ts           # Integración con Gemini AI
│   └── DecisionAgent.ts         # Lógica de decisión
└── baileys.ts                   # Clase principal de WhatsApp
```

### Servicios Principales

#### BotService (`botService.ts`)

Responsable de:
- Inicializar conexión con WhatsApp via Baileys
- Procesar mensajes entrantes
- Coordinar con BotOrchestrator
- Emitir eventos al frontend via Socket.IO

```typescript
// Flujo principal
BotService.initialize()
  → Crea instancia de BaileysClass
  → Inicializa BotOrchestrator
  → Configura event listeners
  → bot.on('message') → processMessage()
```

#### PendingAlertService (`pendingAlertService.ts`)

Gestiona alertas cuando el bot no puede responder:

```typescript
interface PendingAlert {
  id: string;
  chatJid: string;
  customerName: string;
  originalMessage: string;
  analysis: {
    intent: string;
    sentiment: string;
    suggestedTopics: string[];
    urgency: 'low' | 'medium' | 'high';
  };
  conversationContext: Message[];
  status: 'pending' | 'responded' | 'dismissed';
  createdAt: Date;
  respondedAt?: Date;
  respondedBy?: string;
  response?: string;
}
```

**Métodos principales:**
- `createAlert()`: Crea nueva alerta con análisis
- `respondToAlert()`: Responde y opcionalmente aprende
- `dismissAlert()`: Descarta alerta
- `checkRateLimit()`: Evita spam de alertas

#### BotAssignmentService (`botAssignmentService.ts`)

Configuración personalizada por chat:

```typescript
interface BotAssignment {
  id: string;
  chatJid: string;
  chatName: string;
  isGroup: boolean;
  botConfig: {
    enabled: boolean;
    personality: 'professional' | 'friendly' | 'formal';
    language: string;
    customGreeting?: string;
    customFallback?: string;
    allowedCategories: string[];
    maxResponseLength: number;
    responseDelayMs: number;
    autoEscalate: boolean;
    escalateThreshold: number;
    learningEnabled: boolean;
  };
  stats: {
    totalMessages: number;
    autoResponses: number;
    escalations: number;
    learnedResponses: number;
  };
}
```

#### LearningService (`learningService.ts`)

Aprende de las respuestas humanas:

```typescript
interface LearnedResponse {
  id: string;
  originalQuestion: string;
  humanResponse: string;
  chatJid: string;
  alertId: string;
  keywords: string[];
  variations: string[];
  status: 'pending' | 'approved' | 'rejected';
  approvedAt?: Date;
  createdAt: Date;
}
```

**Flujo de aprendizaje:**
1. Humano responde a alerta con `shouldLearn: true`
2. LearningService extrae keywords y genera variaciones
3. Respuesta queda en estado `pending`
4. Admin aprueba → Se crea FAQ en base de conocimiento
5. Bot puede responder automáticamente en el futuro

---

## Frontend

### Estructura de Archivos

```
web/src/
├── api/
│   └── client.ts              # Cliente API (axios)
├── components/
│   ├── alerts/
│   │   ├── AlertPanel.tsx     # Panel lateral de alertas
│   │   ├── AlertCard.tsx      # Tarjeta de alerta individual
│   │   ├── AlertResponseModal.tsx  # Modal para responder
│   │   └── index.ts
│   ├── bot/
│   │   ├── BotAssignmentPanel.tsx  # Config del bot por chat
│   │   └── index.ts
│   ├── chat/
│   │   ├── ChatList.tsx       # Lista de conversaciones
│   │   ├── ChatListItem.tsx   # Item de conversación
│   │   ├── ChatView.tsx       # Vista del chat activo
│   │   ├── MessageBubble.tsx  # Burbuja de mensaje
│   │   └── MessageInput.tsx   # Input de mensaje
│   ├── common/
│   │   ├── Sidebar.tsx        # Barra lateral principal
│   │   └── LoadingSpinner.tsx
│   ├── admin/
│   │   ├── AdminDashboard.tsx # Panel de administración
│   │   ├── KnowledgePanel.tsx # Gestión de FAQs
│   │   ├── BroadcastPanel.tsx # Envío masivo
│   │   └── TicketsPanel.tsx   # Sistema de tickets
│   └── settings/
│       ├── SettingsPanel.tsx  # Configuración general
│       └── SettingsModal.tsx
├── pages/
│   └── ChatPage.tsx           # Página principal
├── store/
│   └── index.ts               # Estado global (Zustand)
└── App.tsx
```

### Estado Global (Zustand)

```typescript
interface AppState {
  // Conexión
  isConnected: boolean;
  qrCode: string | null;
  
  // Chats
  chats: Chat[];
  activeChat: string | null;
  messages: Record<string, Message[]>;
  
  // UI
  isLoadingChats: boolean;
  isLoadingMessages: boolean;
  
  // Alertas
  alertCount: number;
  
  // Actions
  setChats: (chats: Chat[]) => void;
  addMessage: (jid: string, message: Message) => void;
  setChatBotActive: (jid: string, active: boolean) => void;
  markChatAsRead: (jid: string) => void;
  // ...
}
```

### Componentes Principales

#### AlertPanel

Panel lateral derecho que muestra alertas pendientes:

- Filtros por estado (todas, pendientes, respondidas)
- Actualización en tiempo real via WebSocket
- Sonido de notificación para nuevas alertas
- Click en alerta abre modal de respuesta

#### AlertResponseModal

Modal para responder a una alerta:

- Muestra contexto de conversación
- Análisis de intención/sentimiento
- Campo de respuesta con sugerencias
- Toggle para "Aprender de esta respuesta"
- Envía respuesta directamente al chat

#### BotAssignmentPanel

Configuración del bot para un chat específico:

- Toggle activar/desactivar bot
- Selector de personalidad (profesional, amigable, formal)
- Slider de umbral de confianza
- Toggle de escalación automática
- Toggle de aprendizaje
- Estadísticas del chat

---

## Sistema de Bot Inteligente

### BotOrchestrator

Componente central que coordina todos los agentes:

```typescript
class BotOrchestrator extends EventEmitter {
  private qaAgent: QASearchAgent;
  private geminiAgent: GeminiAgent | null;
  private alertService: PendingAlertService;
  private assignmentService: BotAssignmentService;
  private learningService: LearningService;
  
  async processMessage(
    jid: string,
    message: string,
    isFromMe: boolean,
    customerName: string
  ): Promise<BotResponse | null>
}
```

### Flujo de Procesamiento

```
1. Verificar si bot está habilitado para este chat
   └─ No → return null (no responder)

2. Obtener configuración específica del chat
   └─ BotAssignmentService.getByJid() o defaults

3. Buscar en base de conocimiento
   └─ QASearchAgent.search(message)

4. Evaluar confianza del resultado
   ├─ confianza >= umbral → Responder con Q&A
   │   └─ Formatear según personalidad
   │
   └─ confianza < umbral
       │
       5. ¿Gemini disponible?
       ├─ Sí → Intentar respuesta con IA
       │   └─ Analizar si puede responder
       │
       └─ No / No puede responder
           │
           6. ¿Auto-escalación habilitada?
           ├─ Sí → Crear alerta + mensaje "Un momento..."
           │   └─ PendingAlertService.createAlert()
           │
           └─ No → return null
```

### QASearchAgent

Búsqueda semántica en base de conocimiento:

```typescript
interface SearchResult {
  item: FAQItem;
  score: number;
  confidence: number;
  matchedKeywords: string[];
}

class QASearchAgent {
  search(query: string): SearchResult | null;
  addLearnedFaq(data: LearnedFaqData): FAQItem;
  processAnswer(answer: string, variables?: Record<string, string>): string;
}
```

### GeminiAgent

Integración con Google Gemini para respuestas generativas:

```typescript
class GeminiAgent {
  async generateResponse(
    message: string,
    context: Message[],
    personality: string
  ): Promise<string | null>;
  
  async analyzeMessage(message: string): Promise<MessageAnalysis>;
}
```

---

## APIs

### Chat API

```
GET    /api/chats                    # Listar chats
GET    /api/chats/:jid/messages      # Mensajes de un chat
POST   /api/chats/:jid/send          # Enviar mensaje
POST   /api/chats/:jid/bot/toggle    # Toggle bot
POST   /api/chats/:jid/read          # Marcar como leído
DELETE /api/chats/:jid               # Eliminar chat
```

### Alert API

```
GET    /api/alerts                   # Listar alertas
GET    /api/alerts/:id               # Detalle de alerta
POST   /api/alerts/:id/respond       # Responder alerta
POST   /api/alerts/:id/dismiss       # Descartar alerta
GET    /api/alerts/stats             # Estadísticas
```

**Responder alerta:**
```json
POST /api/alerts/:id/respond
{
  "response": "Texto de respuesta",
  "sendToCustomer": true,
  "shouldLearn": true,
  "respondedBy": "admin"
}
```

### Bot Assignment API

```
GET    /api/bot-assignments              # Listar todas
GET    /api/bot-assignments/:jid         # Por chat
POST   /api/bot-assignments              # Crear/actualizar
POST   /api/bot-assignments/:jid/toggle  # Toggle rápido
DELETE /api/bot-assignments/:jid         # Eliminar
GET    /api/bot-assignments/default      # Config por defecto
PUT    /api/bot-assignments/default      # Actualizar default
GET    /api/bot-assignments/stats        # Estadísticas
```

### Learning API

```
GET    /api/learning                 # Respuestas pendientes
GET    /api/learning/:id             # Detalle
POST   /api/learning/:id/approve     # Aprobar (crea FAQ)
POST   /api/learning/:id/reject      # Rechazar
DELETE /api/learning/:id             # Eliminar
GET    /api/learning/stats           # Estadísticas
GET    /api/learning/settings        # Configuración
PUT    /api/learning/settings        # Actualizar config
```

### Knowledge API

```
GET    /api/knowledge/categories     # Listar categorías
POST   /api/knowledge/categories     # Crear categoría
PUT    /api/knowledge/categories/:id # Actualizar
DELETE /api/knowledge/categories/:id # Eliminar

GET    /api/knowledge/faqs           # Listar FAQs
POST   /api/knowledge/faqs           # Crear FAQ
PUT    /api/knowledge/faqs/:id       # Actualizar
DELETE /api/knowledge/faqs/:id       # Eliminar

POST   /api/knowledge/import         # Importar datos
GET    /api/knowledge/export         # Exportar datos
POST   /api/knowledge/search         # Buscar
```

---

## Modelos de Datos

### Chat

```typescript
interface Chat {
  jid: string;              // ID único (número@s.whatsapp.net)
  name: string;             // Nombre del contacto/grupo
  lastMessage?: string;     // Último mensaje
  lastMessageTime?: number; // Timestamp
  unreadCount: number;      // Mensajes sin leer
  isGroup: boolean;         // Es grupo
  botActive: boolean;       // Bot habilitado
  profilePicUrl?: string;   // URL foto de perfil
}
```

### Message

```typescript
interface Message {
  id: string;
  chatJid: string;
  body: string;
  fromMe: boolean;
  timestamp: number;
  status?: 'pending' | 'sent' | 'delivered' | 'read';
  type?: 'text' | 'image' | 'video' | 'audio' | 'document';
  mediaUrl?: string;
  quotedMessage?: Message;
  sender?: string;          // En grupos
  senderName?: string;
}
```

### FAQItem

```typescript
interface FAQItem {
  id: string;
  categoryId: string;
  question: string;
  answer: string;
  keywords: string[];
  variations: string[];     // Formas alternativas de preguntar
  isActive: boolean;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
  metadata?: {
    source: 'manual' | 'learned';
    learnedFromAlertId?: string;
  };
}
```

### Category

```typescript
interface Category {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  order: number;
  isActive: boolean;
}
```

---

## WebSocket Events

### Server → Client

| Evento | Payload | Descripción |
|--------|---------|-------------|
| `qr` | `{ qr: string }` | Nuevo código QR |
| `ready` | `{}` | Conexión lista |
| `message` | `Message` | Nuevo mensaje |
| `message:update` | `{ jid, id, status }` | Actualización de estado |
| `chat:update` | `Chat` | Chat actualizado |
| `bot:response` | `{ jid, response, source }` | Bot respondió |
| `alert:new` | `PendingAlert` | Nueva alerta |
| `alert:responded` | `{ id, response }` | Alerta respondida |
| `alert:dismissed` | `{ id }` | Alerta descartada |

### Client → Server

| Evento | Payload | Descripción |
|--------|---------|-------------|
| `message:send` | `{ jid, body }` | Enviar mensaje |
| `chat:read` | `{ jid }` | Marcar como leído |
| `typing:start` | `{ jid }` | Indicador escribiendo |
| `typing:stop` | `{ jid }` | Detener indicador |

---

## Configuración

### Variables de Entorno

```env
# Servidor
PORT=3001
NODE_ENV=development

# Gemini AI (opcional)
GEMINI_API_KEY=your_api_key_here

# Debug
DEBUG=true
LOG_LEVEL=info
```

### Archivo de Configuración del Bot

`data/bot-config.json`:

```json
{
  "enabled": true,
  "personality": "friendly",
  "language": "es",
  "confidenceThreshold": 0.7,
  "useGemini": true,
  "geminiModel": "gemini-pro",
  "maxResponseLength": 500,
  "responseDelayMs": 1500,
  "autoEscalate": true,
  "learningEnabled": true,
  "greetingMessage": "¡Hola! ¿En qué puedo ayudarte?",
  "fallbackMessage": "Un momento, estoy consultando con mi equipo para darte la mejor respuesta.",
  "offlineMessage": "Gracias por escribir. Responderemos pronto."
}
```

### Base de Conocimiento

`data/knowledge-base.json`:

```json
{
  "categories": [
    {
      "id": "general",
      "name": "General",
      "description": "Preguntas generales",
      "order": 1,
      "isActive": true
    }
  ],
  "faqs": [
    {
      "id": "faq-001",
      "categoryId": "general",
      "question": "¿Cuál es el horario de atención?",
      "answer": "Nuestro horario es de lunes a viernes de 9:00 a 18:00.",
      "keywords": ["horario", "atención", "hora", "abierto"],
      "variations": [
        "¿A qué hora abren?",
        "¿Cuándo están disponibles?",
        "horarios de atención"
      ],
      "isActive": true,
      "priority": 1
    }
  ]
}
```

---

## Guía de Desarrollo

### Requisitos

- Node.js 18+
- pnpm (recomendado) o npm

### Instalación

```bash
git clone <repo>
cd bot-wa-baileys
pnpm install
```

### Scripts

```bash
# Desarrollo completo
pnpm run dev

# Solo backend
pnpm run server

# Solo frontend
pnpm run web

# Build producción
pnpm run build

# Lint
pnpm run lint
```

### Agregar Nueva Funcionalidad

1. **Backend Service**: Crear en `src/server/services/`
2. **Controller**: Crear en `src/server/controllers/`
3. **Routes**: Agregar en `src/server/routes/index.ts`
4. **Frontend API**: Agregar en `web/src/api/client.ts`
5. **Componente UI**: Crear en `web/src/components/`
6. **Store**: Actualizar `web/src/store/` si es necesario

### Debugging

```bash
# Logs del servidor
DEBUG=* pnpm run server

# Logs específicos
DEBUG=baileys:* pnpm run server
DEBUG=bot:* pnpm run server
```

### Testing Manual

1. Iniciar servidor: `pnpm run dev`
2. Abrir dashboard: `http://localhost:5174`
3. Escanear QR con WhatsApp
4. Enviar mensaje de prueba desde otro número
5. Verificar respuesta del bot en dashboard y WhatsApp

---

## Métricas y KPIs

El sistema registra las siguientes métricas:

| Métrica | Descripción |
|---------|-------------|
| `totalMessages` | Total de mensajes procesados |
| `autoResponses` | Respuestas automáticas exitosas |
| `escalations` | Alertas creadas |
| `learnedResponses` | FAQs aprendidas |
| `avgResponseTime` | Tiempo promedio de respuesta |
| `avgConfidence` | Confianza promedio de búsquedas |

Accesibles via:
- `GET /api/bot-assignments/stats`
- `GET /api/alerts/stats`
- `GET /api/learning/stats`

---

## Seguridad

### Consideraciones Implementadas

- ✅ Rate limiting en alertas por chat
- ✅ Validación de inputs en controladores
- ✅ Sanitización de respuestas
- ✅ CORS configurado
- ✅ Variables sensibles en .env

### Pendientes

- [ ] Autenticación de usuarios admin
- [ ] JWT para API
- [ ] Encriptación de datos sensibles
- [ ] Audit logging

---

## Próximos Pasos

1. **Autenticación**: Sistema de login para dashboard
2. **Multi-tenant**: Soporte para múltiples cuentas
3. **Analytics**: Dashboard de métricas avanzadas
4. **Integrations**: Webhooks para sistemas externos
5. **Templates**: Plantillas de mensajes predefinidas
6. **Scheduling**: Programación de mensajes
7. **AI Training**: Fine-tuning de respuestas con datos propios
