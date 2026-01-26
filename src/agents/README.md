# Agentes de IA

Sistema de bot inteligente con respuestas hibridas (Q&A local + Gemini AI).

## Arquitectura

```
Mensaje entrante
       │
       ▼
┌──────────────────┐
│  BotOrchestrator │──────────▶ Coordinador principal
└────────┬─────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌───────┐ ┌───────┐
│  Q&A  │ │Gemini │
│Search │ │  AI   │
└───────┘ └───────┘
```

## Agentes Disponibles

### DecisionAgent
**Proposito**: Controlar que chats tienen el bot activo.

```typescript
// Uso
const agent = new DecisionAgent();
agent.setBotStatus(jid, true);  // Activar bot para este chat
agent.isBotActive(jid);         // Verificar si esta activo
agent.shouldReply(jid, isFromMe); // Decidir si responder
```

### QASearchAgent
**Proposito**: Buscar respuestas en base de conocimiento local.

**Archivo de datos**: `data/knowledge-base.json`

```typescript
const agent = new QASearchAgent();

// Buscar respuesta
const result = agent.search("cual es su horario?");
// { item: QAItem, category: QACategory, confidence: 0.85 }

// Obtener items relacionados para contexto
const related = agent.getRelatedItems(query, 3);

// CRUD de categorias y preguntas
agent.addCategory({ id, name, icon });
agent.addQuestion(categoryId, { keywords, questions, answer });
```

### GeminiAgent
**Proposito**: Generar respuestas con IA cuando no hay match local.

**Requiere**: `GEMINI_API_KEY` en variables de entorno.

```typescript
const agent = new GeminiAgent({
    geminiApiKey: process.env.GEMINI_API_KEY,
    contextFilePath: './knowledge_base.txt'
});

const response = await agent.generateResponse(message, context);
```

### BotOrchestrator
**Proposito**: Orquestar el flujo completo de respuesta.

**Flujo**:
1. Verificar si bot esta activo para el chat
2. Buscar en Q&A local (confidence >= 0.7)
3. Si no hay match, usar Gemini con contexto
4. Si Gemini falla, devolver mensaje fallback

```typescript
const orchestrator = BotOrchestrator.getInstance();

// Procesar mensaje
const response = await orchestrator.processMessage(jid, message);
// { source: 'qa' | 'gemini' | 'fallback', response: string }

// Probar sin enviar
const test = await orchestrator.testMessage("hola");

// Configuracion
orchestrator.toggleChat(jid, true);
orchestrator.updateConfig({ minConfidenceForQA: 0.8 });
```

## Base de Conocimiento

### Estructura (`data/knowledge-base.json`)

```json
{
    "business": {
        "name": "Mi Negocio",
        "description": "...",
        "tone": "profesional y amigable"
    },
    "categories": [
        {
            "id": "horarios",
            "name": "Horarios",
            "icon": "clock",
            "items": [
                {
                    "id": "qa-001",
                    "keywords": ["horario", "hora", "abierto"],
                    "questions": ["Cual es su horario?"],
                    "answer": "Lunes a Viernes 8am-6pm",
                    "priority": 1
                }
            ]
        }
    ],
    "fallback": {
        "noMatch": "Lo siento, no tengo esa informacion.",
        "useGemini": true,
        "geminiPrompt": "Eres un asistente de {business.name}..."
    }
}
```

### Variables en respuestas
- `{business.name}` - Nombre del negocio
- `{business.description}` - Descripcion
- `{business.tone}` - Tono de comunicacion

## Configuracion (`data/bot-config.json`)

```json
{
    "enabled": true,
    "geminiApiKey": "...",
    "settings": {
        "minConfidenceForQA": 0.7,
        "useGeminiFallback": true,
        "typingIndicator": true,
        "typingDelayMs": 1500
    }
}
```
