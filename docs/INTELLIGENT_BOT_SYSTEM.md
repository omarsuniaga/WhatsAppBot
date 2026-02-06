# 🤖 Sistema Inteligente de Bot WhatsApp

## Índice
1. [Descripción General](#descripción-general)
2. [Arquitectura del Sistema](#arquitectura-del-sistema)
3. [Módulos Principales](#módulos-principales)
4. [API Reference](#api-reference)
5. [Configuración](#configuración)
6. [Guía de Uso](#guía-de-uso)
7. [Ejemplos](#ejemplos)

---

## Descripción General

El Sistema Inteligente de Bot WhatsApp es una plataforma completa que permite:

- **📚 Respuestas Automáticas**: Responde preguntas frecuentes usando una base de conocimiento + IA (Gemini)
- **🎫 Sistema de Escalación**: Cuando el bot no puede responder, crea tickets y notifica a administradores
- **📢 Difusión Masiva**: Envía mensajes personalizados a múltiples contactos con protección anti-spam
- **📊 Panel de Gestión**: Interfaz web para administrar FAQs, tickets y campañas

### Características Principales

| Característica | Descripción |
|----------------|-------------|
| Respuestas con IA | Usa Gemini para entender contexto y adaptar respuestas |
| Búsqueda Semántica | Encuentra FAQs similares aunque la pregunta sea diferente |
| Aprendizaje Automático | Aprende nuevas respuestas de las interacciones con admins |
| Notificaciones WhatsApp | Notifica a admins directamente por WhatsApp |
| Anti-Spam | Delays inteligentes y límites para evitar bloqueos |
| Personalización | Variables dinámicas en mensajes ({nombre}, {fecha}) |

---

## Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React + TypeScript)                    │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │ ChatPanel   │  │ Knowledge   │  │  Tickets    │  │  Broadcast  │    │
│  │             │  │   Panel     │  │   Panel     │  │   Panel     │    │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │ HTTP/WebSocket
┌────────────────────────────────▼────────────────────────────────────────┐
│                         BACKEND (Node.js + Express)                      │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    IntelligentBotService                         │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │   │
│  │  │ AutoResponse│  │ Escalation  │  │  Broadcast  │              │   │
│  │  │   Service   │  │   Service   │  │   Service   │              │   │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │   │
│  │         │                │                │                      │   │
│  │  ┌──────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐              │   │
│  │  │ Knowledge   │  │   Ticket    │  │  Campaign   │              │   │
│  │  │    Base     │  │   Manager   │  │   Manager   │              │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘              │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                 │                                       │
│  ┌──────────────────────────────▼──────────────────────────────────┐   │
│  │                      BotService (Baileys)                        │   │
│  │                    WhatsApp Connection Layer                     │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │   WhatsApp Servers      │
                    └─────────────────────────┘
```

---

## Módulos Principales

### 1. 📚 Knowledge Base (Base de Conocimiento)

**Ubicación**: `src/server/services/knowledgeBaseService.ts`

Gestiona las preguntas frecuentes y respuestas automáticas.

#### Estructura de una FAQ:
```typescript
interface FAQ {
    id: string;
    category: string;           // Categoría (general, productos, soporte)
    questions: string[];        // Variaciones de la pregunta
    answer: string;             // Respuesta base
    keywords: string[];         // Palabras clave para búsqueda
    confidence: number;         // Nivel de confianza (0-1)
    usageCount: number;         // Contador de uso
    approved: boolean;          // Si está aprobada para uso
    createdBy: 'admin' | 'ai_learned';
}
```

#### Funcionalidades:
- **Búsqueda por keywords**: Encuentra FAQs por palabras clave
- **Búsqueda semántica**: Usa similitud de texto para encontrar coincidencias
- **Aprendizaje**: Crea nuevas FAQs automáticamente de respuestas admin
- **Categorización**: Organiza FAQs por categorías
- **Import/Export**: Exporta e importa FAQs en formato JSON

### 2. 🤖 Auto Response (Respuestas Automáticas)

**Ubicación**: `src/server/services/autoResponseService.ts`

Procesa mensajes entrantes y genera respuestas inteligentes.

#### Flujo de Procesamiento:
```
Mensaje Entrante
      │
      ▼
┌─────────────────┐
│ Quick Response? │ ──► Saludos, agradecimientos → Respuesta rápida
└────────┬────────┘
         │ No
         ▼
┌─────────────────┐
│ Buscar en FAQs  │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
Score ≥ 0.85  Score < 0.50
    │         │
    ▼         ▼
 Responder   Escalar
 Directo     a Humano
```

#### Configuración:
```typescript
interface KnowledgeBaseConfig {
    minConfidenceToRespond: number;    // 0.85 - Responder automáticamente
    minConfidenceToConfirm: number;    // 0.50 - Responder con confirmación
    maxContextMessages: number;        // 10 - Mensajes de contexto
    businessName: string;              // Nombre del negocio
    toneStyle: 'formal' | 'friendly' | 'professional';
}
```

### 3. 🎫 Escalation (Sistema de Tickets)

**Ubicación**: `src/server/services/escalationService.ts`

Gestiona tickets de soporte cuando el bot no puede responder.

#### Estructura de un Ticket:
```typescript
interface EscalationTicket {
    id: string;
    chatJid: string;
    customerName: string;
    originalMessage: string;
    status: 'pending' | 'assigned' | 'in_progress' | 'resolved';
    priority: 'low' | 'medium' | 'high' | 'urgent';
    assignedTo?: string;        // JID del admin asignado
    adminResponse?: string;     // Respuesta del admin
    shouldLearn: boolean;       // Guardar en KB
}
```

#### Flujo de Escalación:
1. **Bot no puede responder** → Crea ticket
2. **Mensaje al cliente**: "Tu consulta será atendida por un agente..."
3. **Notificación al admin** vía WhatsApp con el contexto
4. **Admin responde** usando formato `#TICKET_ID respuesta`
5. **Respuesta enviada** al cliente automáticamente
6. **Opcional**: Guardar respuesta en Knowledge Base

#### Formato de Respuesta Admin:
```
#abc123-def456 Gracias por contactarnos. El precio del producto es $50.
```

### 4. 📢 Broadcast (Difusión Masiva)

**Ubicación**: `src/server/services/broadcastService.ts`

Envía mensajes masivos a múltiples contactos.

#### Estructura de una Campaña:
```typescript
interface BroadcastCampaign {
    id: string;
    name: string;
    message: string;
    targetLists: string[];      // IDs de listas de contactos
    status: 'draft' | 'running' | 'paused' | 'completed';
    
    // Métricas
    totalRecipients: number;
    sent: number;
    delivered: number;
    failed: number;
    
    // Configuración Anti-Spam
    delayBetweenMessages: number;   // 3000ms default
    randomizeDelay: boolean;        // Humanizar envíos
    personalizeMessage: boolean;    // Usar {nombre}
}
```

#### Protección Anti-Ban:
- **Delays aleatorios**: 2-5 segundos entre mensajes
- **Horarios permitidos**: 8:00 AM - 8:00 PM
- **Cooldown por contacto**: 24 horas entre mensajes
- **Límite diario**: Máximo N mensajes por contacto
- **Lista negra**: Números bloqueados

---

## API Reference

### Knowledge Base API

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/api/knowledge/config` | Obtener configuración |
| `PUT` | `/api/knowledge/config` | Actualizar configuración |
| `GET` | `/api/knowledge/categories` | Listar categorías |
| `POST` | `/api/knowledge/categories` | Crear categoría |
| `GET` | `/api/knowledge/faqs` | Listar FAQs |
| `POST` | `/api/knowledge/faqs` | Crear FAQ |
| `PUT` | `/api/knowledge/faqs/:id` | Actualizar FAQ |
| `DELETE` | `/api/knowledge/faqs/:id` | Eliminar FAQ |
| `POST` | `/api/knowledge/faqs/:id/approve` | Aprobar FAQ |
| `GET` | `/api/knowledge/search?query=` | Buscar FAQs |
| `POST` | `/api/knowledge/learn` | Aprender respuesta |
| `GET` | `/api/knowledge/export` | Exportar datos |
| `POST` | `/api/knowledge/import` | Importar datos |
| `GET` | `/api/knowledge/stats` | Estadísticas |

### Escalation API

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/api/escalation/config` | Obtener configuración |
| `PUT` | `/api/escalation/config` | Actualizar configuración |
| `GET` | `/api/escalation/admins` | Listar administradores |
| `POST` | `/api/escalation/admins` | Agregar administrador |
| `PUT` | `/api/escalation/admins/:jid` | Actualizar admin |
| `DELETE` | `/api/escalation/admins/:jid` | Eliminar admin |
| `GET` | `/api/escalation/tickets` | Listar tickets |
| `GET` | `/api/escalation/tickets/pending` | Tickets pendientes |
| `GET` | `/api/escalation/tickets/:id` | Obtener ticket |
| `POST` | `/api/escalation/tickets` | Crear ticket |
| `POST` | `/api/escalation/tickets/:id/assign` | Asignar ticket |
| `POST` | `/api/escalation/tickets/:id/resolve` | Resolver ticket |
| `POST` | `/api/escalation/tickets/:id/close` | Cerrar ticket |
| `GET` | `/api/escalation/stats` | Estadísticas |

### Broadcast API

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/api/broadcast/config` | Obtener configuración |
| `PUT` | `/api/broadcast/config` | Actualizar configuración |
| `GET` | `/api/broadcast/lists` | Listar listas de contactos |
| `POST` | `/api/broadcast/lists` | Crear lista |
| `GET` | `/api/broadcast/lists/:id` | Obtener lista |
| `PUT` | `/api/broadcast/lists/:id` | Actualizar lista |
| `DELETE` | `/api/broadcast/lists/:id` | Eliminar lista |
| `POST` | `/api/broadcast/lists/:id/contacts` | Agregar contacto |
| `DELETE` | `/api/broadcast/lists/:id/contacts/:jid` | Eliminar contacto |
| `POST` | `/api/broadcast/lists/:id/import` | Importar contactos |
| `GET` | `/api/broadcast/templates` | Listar plantillas |
| `POST` | `/api/broadcast/templates` | Crear plantilla |
| `GET` | `/api/broadcast/campaigns` | Listar campañas |
| `POST` | `/api/broadcast/campaigns` | Crear campaña |
| `POST` | `/api/broadcast/campaigns/:id/start` | Iniciar campaña |
| `POST` | `/api/broadcast/campaigns/:id/pause` | Pausar campaña |
| `GET` | `/api/broadcast/campaigns/:id/progress` | Progreso campaña |
| `GET` | `/api/broadcast/stats` | Estadísticas |

---

## Configuración

### Variables de Entorno

```env
# API Key de Gemini para IA
GEMINI_API_KEY=tu_api_key_aqui

# Puerto del servidor
PORT=3001

# Configuración del bot
BOT_NAME=mi-bot
```

### Configurar Administrador Principal

```bash
curl -X POST http://localhost:3001/api/escalation/admins \
  -H "Content-Type: application/json" \
  -d '{
    "jid": "1234567890@s.whatsapp.net",
    "name": "Admin Principal",
    "role": "super_admin",
    "notifyOnNewTicket": true,
    "notifyOnUrgent": true
  }'
```

### Configurar Knowledge Base

```bash
curl -X PUT http://localhost:3001/api/knowledge/config \
  -H "Content-Type: application/json" \
  -d '{
    "businessName": "Mi Empresa",
    "businessDescription": "Vendemos productos increíbles",
    "toneStyle": "professional",
    "minConfidenceToRespond": 0.85
  }'
```

---

## Guía de Uso

### 1. Agregar FAQs

**Desde el Panel Web:**
1. Ir a "Base de Conocimiento"
2. Click en "Nueva FAQ"
3. Seleccionar categoría
4. Agregar preguntas (variaciones)
5. Escribir la respuesta
6. Agregar keywords
7. Guardar

**Desde la API:**
```bash
curl -X POST http://localhost:3001/api/knowledge/faqs \
  -H "Content-Type: application/json" \
  -d '{
    "category": "productos",
    "questions": [
      "¿Cuánto cuesta el producto?",
      "¿Cuál es el precio?",
      "¿Qué valor tiene?"
    ],
    "answer": "Nuestros productos tienen precios desde $50. Para un precio específico, indícanos qué producto te interesa.",
    "keywords": ["precio", "costo", "valor", "cuanto"]
  }'
```

### 2. Gestionar Tickets

**El admin recibe por WhatsApp:**
```
📋 *Nuevo Ticket de Soporte*

🟡 Prioridad: MEDIUM
👤 Cliente: Juan Pérez
📱 Teléfono: 1234567890

💬 *Mensaje:*
¿Tienen envíos a domicilio?

Para responder, usa:
#abc123-def456 tu respuesta aquí
```

**El admin responde:**
```
#abc123-def456 ¡Sí! Hacemos envíos a todo el país. El costo es $10 para zonas urbanas.
```

### 3. Crear Campaña de Difusión

1. **Crear lista de contactos:**
```bash
curl -X POST http://localhost:3001/api/broadcast/lists \
  -H "Content-Type: application/json" \
  -d '{"name": "Clientes VIP", "description": "Clientes frecuentes"}'
```

2. **Importar contactos:**
```bash
curl -X POST http://localhost:3001/api/broadcast/lists/{LIST_ID}/import \
  -H "Content-Type: application/json" \
  -d '{
    "contacts": [
      {"phone": "1234567890", "name": "Juan"},
      {"phone": "0987654321", "name": "María"}
    ]
  }'
```

3. **Crear y ejecutar campaña:**
```bash
curl -X POST http://localhost:3001/api/broadcast/campaigns \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Promoción Enero",
    "message": "¡Hola {nombre}! 🎉 Tenemos una promoción especial para ti...",
    "targetLists": ["LIST_ID"],
    "personalizeMessage": true
  }'

curl -X POST http://localhost:3001/api/broadcast/campaigns/{CAMPAIGN_ID}/start
```

---

## Ejemplos

### Ejemplo de FAQ Completa

```json
{
  "category": "soporte",
  "questions": [
    "¿Cómo puedo hacer un reclamo?",
    "Quiero hacer una queja",
    "¿Dónde presento un reclamo?",
    "Tengo un problema con mi pedido"
  ],
  "answer": "Lamentamos los inconvenientes. Para presentar un reclamo:\n\n1️⃣ Envíanos tu número de pedido\n2️⃣ Describe el problema\n3️⃣ Adjunta fotos si es necesario\n\nUn agente te contactará en máximo 24 horas. 🙏",
  "keywords": ["reclamo", "queja", "problema", "inconveniente", "mal", "error"]
}
```

### Ejemplo de Plantilla de Mensaje

```json
{
  "name": "Bienvenida",
  "category": "onboarding",
  "content": "¡Hola {nombre}! 👋\n\nBienvenido/a a {empresa}. Estamos aquí para ayudarte.\n\n¿En qué podemos asistirte hoy?",
  "variables": ["nombre", "empresa"]
}
```

---

## Estructura de Archivos

```
src/server/
├── types/
│   ├── knowledge.ts      # Tipos para Knowledge Base
│   ├── escalation.ts     # Tipos para Escalación
│   └── broadcast.ts      # Tipos para Broadcast
├── services/
│   ├── knowledgeBaseService.ts   # Servicio de FAQs
│   ├── autoResponseService.ts    # Respuestas automáticas
│   ├── escalationService.ts      # Sistema de tickets
│   ├── broadcastService.ts       # Difusión masiva
│   └── intelligentBotService.ts  # Integración
├── controllers/
│   ├── knowledgeController.ts    # API Knowledge Base
│   ├── escalationController.ts   # API Escalación
│   └── broadcastController.ts    # API Broadcast
└── routes/
    └── index.ts                  # Rutas registradas

web/src/components/admin/
├── KnowledgePanel.tsx    # Panel de FAQs
├── TicketsPanel.tsx      # Panel de Tickets
├── BroadcastPanel.tsx    # Panel de Difusión
└── index.ts              # Exportaciones

data/
├── knowledge-base.json   # FAQs y categorías
├── escalation.json       # Tickets y admins
└── broadcast.json        # Campañas y listas
```

---

## Troubleshooting

### El bot no responde automáticamente
1. Verificar que el chat tenga el bot activo
2. Revisar configuración de `minConfidenceToRespond`
3. Verificar que haya FAQs aprobadas

### Las notificaciones no llegan al admin
1. Verificar que el admin esté registrado
2. Confirmar que `isActive: true`
3. Verificar que `notifyOnNewTicket: true`

### La campaña no envía mensajes
1. Verificar horarios permitidos
2. Revisar que la lista tenga contactos
3. Verificar que no estén en lista negra

---

## Licencia

Este sistema es parte del proyecto WhatsApp Bot con Baileys.
