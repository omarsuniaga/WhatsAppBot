# 🤖 Instrucciones para Agentes de IA

> **Archivo de configuración para cualquier LLM** (Claude, ChatGPT, Copilot, Gemini, Qwen, etc.)  
> Este archivo define cómo los modelos de lenguaje deben interactuar con este repositorio.

---

## 📋 Carga Obligatoria

Antes de trabajar en este proyecto, el agente DEBE leer:

1. **[AGENTS.md](./AGENTS.md)** — Sistema de agentes, reglas y convenciones
2. **[/docs/TECHNICAL_DOCUMENTATION.md](./docs/TECHNICAL_DOCUMENTATION.md)** — Arquitectura actual
3. El agente específico que se invoque en `/agents/`

---

## 🎯 Contexto del Proyecto

### ¿Qué es este proyecto?
Una plataforma de WhatsApp Bot con dashboard de gestión, que permite:
- Respuestas automáticas inteligentes vía Knowledge Base
- Escalación a humanos cuando el bot no puede responder
- Configuración por chat individual
- Aprendizaje de respuestas humanas

### Stack Tecnológico
| Capa | Tecnología |
|------|------------|
| WhatsApp | Baileys (no oficial) |
| Backend | Node.js + Express + TypeScript |
| Frontend | React + Vite + TailwindCSS |
| Comunicación | Socket.IO |
| Persistencia | JSON files (por ahora) |
| IA (opcional) | Google Gemini |

### Arquitectura Simplificada
```
WhatsApp ←→ Baileys ←→ BotService ←→ BotOrchestrator
                            ↓              ↓
                       Socket.IO    Services (Alert, Assignment, Learning)
                            ↓              ↓
                        React App      JSON Storage
```

---

## ⚠️ Reglas Críticas

### 1. NO inventar capacidades
El proyecto actualmente tiene:
- ✅ Envío/recepción de mensajes WhatsApp
- ✅ Knowledge Base en JSON
- ✅ BotOrchestrator con Q&A + Gemini fallback
- ✅ Sistema de alertas para escalación
- ✅ Configuración por chat (BotAssignment)
- ✅ Dashboard React funcional

NO tiene (aún):
- ❌ Base de datos relacional
- ❌ Sistema de autenticación
- ❌ Broadcast/mensajes masivos
- ❌ Gestión de grupos
- ❌ Workflows/automatizaciones

### 2. NO hardcodear secrets
```typescript
// ❌ NUNCA
const apiKey = "sk-1234567890";

// ✅ SIEMPRE
const apiKey = process.env.GEMINI_API_KEY;
```

### 3. Seguir la arquitectura existente
- Services: Patrón Singleton con EventEmitter
- Controllers: Funciones async con try/catch
- Rutas: Centralizadas en `/src/server/routes/index.ts`
- Componentes: React funcional con hooks

### 4. Rate limiting obligatorio para WhatsApp
```typescript
// ✅ SIEMPRE incluir delay entre mensajes
await this.sendText(jid, message);
await new Promise(r => setTimeout(r, 2000)); // Mínimo 2s
```

### 5. Anti-loop obligatorio
```typescript
// ✅ SIEMPRE verificar antes de responder
if (isFromMe) return null; // No responder a mensajes propios
```

---

## 🚀 Cómo Invocar Agentes

### Formato
```
/[agente] [tarea o contexto]
```

### Agentes Disponibles
| Comando | Agente | Uso |
|---------|--------|-----|
| `/orquestador` | Orchestrator | Planificar, priorizar, coordinar |
| `/architect` | Arquitecto | Diseñar sistemas, crear ADRs |
| `/uiux` | UI/UX | Diseñar interfaces y flujos |
| `/kb` | Knowledge Base | Gestionar FAQs y contenido |
| `/devops` | DevOps | CI/CD, deploy, infraestructura |
| `/reviewer` | Revisor | Code review |
| `/documenter` | Documentador | Crear/actualizar docs |
| `/tester` | Tester | Tests y QA |
| `/developer` | Developer | Implementar código |

### Ejemplos de Invocación
```markdown
/orquestador Planifica las tareas para completar Fase A del roadmap

/developer Implementa el CRUD de Knowledge Base con endpoints REST

/tester Crea tests unitarios para PendingAlertService

/reviewer Revisa el código del BroadcastService buscando issues de seguridad

/documenter Documenta la API de alertas con ejemplos de uso
```

---

## 📁 Estructura del Proyecto

```
/
├── AGENTS.md              # 📋 Índice de agentes (LEER PRIMERO)
├── CLAUDE.md              # 📖 Este archivo
├── README.md              # 📘 Overview del proyecto
├── ROADMAP.md             # 🗺️ Plan de fases
│
├── /agents/               # 🤖 Definiciones de agentes
│   ├── 00-ORCHESTRATOR.md
│   ├── 01-ARCHITECT.md
│   ├── 02-UI-UX.md
│   ├── 03-KNOWLEDGE_BASE.md
│   ├── 04-DEVOPS.md
│   ├── 05-REVIEWER.md
│   ├── 06-DOCUMENTER.md
│   ├── 07-TESTER.md
│   └── 08-DEVELOPER.md
│
├── /docs/                 # 📚 Documentación
│   ├── TECHNICAL_DOCUMENTATION.md
│   ├── TONE_GUIDE.md
│   ├── /adrs/             # Decisiones arquitectónicas
│   │   └── ADR_TEMPLATE.md
│   └── /templates/        # Plantillas
│       ├── PR_CHECKLIST.md
│       ├── TEST_PLAN_TEMPLATE.md
│       ├── DOC_TEMPLATE.md
│       └── KB_ENTRY_TEMPLATE.md
│
├── /src/                  # 💻 Código backend
│   ├── /agents/           # Agentes de IA (BotOrchestrator, etc.)
│   ├── /server/
│   │   ├── /services/     # Lógica de negocio
│   │   ├── /controllers/  # Handlers HTTP
│   │   └── /routes/       # Definición de rutas
│   └── index.ts           # Entry point
│
├── /web/                  # 🌐 Frontend React
│   └── /src/
│       ├── /components/   # Componentes React
│       ├── /pages/        # Páginas
│       ├── /hooks/        # Custom hooks
│       ├── /api/          # Cliente API
│       └── /store/        # Estado (Zustand)
│
└── /data/                 # 💾 Datos persistentes (JSON)
    ├── knowledge-base.json
    ├── bot-config.json
    └── pending-alerts.json
```

---

## 📊 Flujo de Trabajo Recomendado

### Para nuevas features:
1. `/orquestador` — Planificar y descomponer
2. `/architect` — Diseñar si es complejo
3. `/developer` — Implementar
4. `/tester` — Crear tests
5. `/reviewer` — Code review
6. `/documenter` — Documentar

### Para bugs:
1. `/tester` — Reproducir y documentar bug
2. `/developer` — Implementar fix
3. `/reviewer` — Revisar fix
4. `/tester` — Verificar fix

### Para mejoras de KB:
1. `/kb` — Crear/mejorar FAQs
2. Revisar con TONE_GUIDE.md
3. Agregar al JSON

---

## 🔍 Referencias Rápidas

| Necesito... | Ver... |
|-------------|--------|
| Entender el sistema de agentes | [AGENTS.md](./AGENTS.md) |
| Ver arquitectura técnica | [/docs/TECHNICAL_DOCUMENTATION.md](./docs/TECHNICAL_DOCUMENTATION.md) |
| Crear un PR | [/docs/templates/PR_CHECKLIST.md](./docs/templates/PR_CHECKLIST.md) |
| Escribir tests | [/docs/templates/TEST_PLAN_TEMPLATE.md](./docs/templates/TEST_PLAN_TEMPLATE.md) |
| Documentar algo | [/docs/templates/DOC_TEMPLATE.md](./docs/templates/DOC_TEMPLATE.md) |
| Crear FAQ | [/docs/templates/KB_ENTRY_TEMPLATE.md](./docs/templates/KB_ENTRY_TEMPLATE.md) |
| Tomar decisión arquitectónica | [/docs/adrs/ADR_TEMPLATE.md](./docs/adrs/ADR_TEMPLATE.md) |
| Escribir respuestas del bot | [/docs/TONE_GUIDE.md](./docs/TONE_GUIDE.md) |

---

## ⚡ Comandos Útiles

```bash
# Desarrollo
npm run dev          # Backend + hot reload
npm run web:dev      # Frontend dev server

# Build
npm run build        # Compilar TypeScript
npm run web:build    # Build frontend

# Quality
npm run lint         # Linter
npm run test         # Tests
```

---

## 🆘 Cuando No Sabes Qué Hacer

1. **Lee AGENTS.md** — Probablemente hay un agente para tu tarea
2. **Usa `/orquestador`** — Te ayudará a planificar
3. **Revisa TECHNICAL_DOCUMENTATION.md** — Entiende la arquitectura
4. **Pregunta al humano** — Si realmente no sabes, es mejor preguntar

---

*Archivo de configuración para agentes de IA — WhatsApp Bot Platform v1.0*
