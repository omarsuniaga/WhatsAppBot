# SPEC — Conversación Guiada, Citas y Re-engagement por WhatsApp

> **Estado:** Propuesta (spec funcional/técnica, pendiente de ADR y priorización)
> **Relación con otros documentos:**
> - Arquitectura y flujo actual del bot → [`INTELLIGENT_BOT_SYSTEM.md`](./INTELLIGENT_BOT_SYSTEM.md)
> - Servicios existentes/planificados (`PendingAlertService`, `BotAssignmentService`, `LearningService`) → [`PLAN_BOT_INTELIGENTE.md`](./PLAN_BOT_INTELIGENTE.md)
> - Entidades institucionales (Alumno, Representante, Agrupación) → [`FEATURE_SPEC.md`](./FEATURE_SPEC.md)
> - Fases del producto → [`../ROADMAP.md`](../ROADMAP.md)
>
> Esta spec **no reemplaza** los documentos anteriores. Define una capa nueva —conversación guiada, citas y seguimiento— que se apoya en los servicios ya existentes o planificados, sin duplicarlos.

---

## 0. Resumen ejecutivo

El bot actual responde preguntas (KB + Gemini) y escala lo que no sabe. Esta spec añade una capa de **conducción activa de la conversación**: saludar según el tipo de contacto, detectar intención de negocio (cotizar, agendar, cancelar), guiar el chat hacia un objetivo configurable por campaña, y sugerir retomar conversaciones frías — siempre con aprobación humana antes de enviar cualquier mensaje de seguimiento. El caso de uso principal es comercial/institucional: convertir conversaciones de WhatsApp en citas o cotizaciones confirmadas (eventos hoteleros, clases, actividades institucionales de FUNEYCA PC / Sistema Punta Cana), manteniendo el principio de "control humano siempre" ya establecido en `AGENTS.md`.

---

## 1. Alcance y no-alcance

### Entra en esta fase
- Perfil de contacto persistente (tipo de relación, idioma, historial resumido)
- Detección de intención sobre el mensaje entrante (adicional al Q&A existente)
- Motor de "flujos guiados" configurables por JSON/dashboard (sin tocar código)
- Máquina de estados de conversación por chat
- Entidad "Cita" con estados básicos (propuesta/confirmada/cancelada/reagendada)
- Cola de sugerencias de seguimiento (re-engagement) con aprobación humana obligatoria
- Extensión del análisis de Gemini ya usado en `PendingAlertService` para incluir intención y entidades (fecha, tipo de evento)

### No entra en esta fase (explícitamente fuera)
- Broadcast masivo automático sin supervisión (ya fuera de alcance según `CLAUDE.md`)
- Integración con calendario externo (Google Calendar) — queda como opción evaluada, no implementada
- Migración a base de datos relacional — se diseña el modelo pensando en ello, pero se implementa en JSON
- Autenticación de usuarios del dashboard (fuera del alcance actual del proyecto)
- Envío de mensajes de seguimiento 100% autónomo sin revisión humana

---

## 2. Casos de uso

| # | Historia de usuario |
|---|---|
| U1 | Como coordinador, quiero que el bot salude distinto a un hotel cliente que a un alumno, para que el tono sea apropiado desde el primer mensaje. |
| U2 | Como coordinador, quiero que el bot detecte cuando alguien quiere cotizar/agendar un evento, para no perder la oportunidad si no reviso el chat de inmediato. |
| U3 | Como administrador del sistema, quiero configurar "temas objetivo" (ej. cotización de evento hotelero) desde el dashboard, sin pedirle a un desarrollador que toque código. |
| U4 | Como coordinador, quiero que el sistema me avise qué conversaciones llevan X días sin respuesta del contacto, y me sugiera un mensaje de retomo, para no perder leads. |
| U5 | Como coordinador, quiero aprobar manualmente cada mensaje de seguimiento antes de que se envíe, para evitar spam o mensajes fuera de tono. |
| U6 | Como coordinador, quiero ver una "cita" creada automáticamente en estado propuesto cuando el bot detecta una fecha y un tipo de evento en la conversación, para solo tener que confirmarla. |
| U7 | Como contacto, quiero poder decir "no me escribas más" y que el sistema respete eso permanentemente. |

---

## 3. Máquina de estados de conversación

Estados por `chatJid` (se añade como extensión del registro de chat, no reemplaza `BotAssignment`):

```
nuevo_contacto
   → saludo_enviado
      → descubrimiento_intencion
         → guiado_a_objetivo        (flujo activo, ver sección 5)
            → objetivo_cumplido     (ej. cita_propuesta)
            → objetivo_abandonado   (silencio > umbral configurable)
            → escalado_humano       (ya cubierto por PendingAlertService)
         → conversacion_general     (Q&A normal, sin flujo activo)
   → seguimiento_sugerido           (desde objetivo_abandonado o conversacion_general fría)
      → seguimiento_aprobado_y_enviado
      → seguimiento_descartado
```

Transiciones disparadas por: mensaje entrante, resultado del análisis de intención (Gemini), timeout de inactividad (job programado), y acción humana en el dashboard (aprobar/descartar seguimiento, confirmar cita).

---

## 4. Modelo de contexto conversacional

Por chat se mantiene un **resumen**, no el historial completo, para no exceder límites de tokens al llamar a Gemini:

```typescript
interface ConversationContext {
  chatJid: string;
  contactProfile: {
    displayName: string;
    relationType: 'cliente_hotel' | 'amigo' | 'alumno' | 'institucional' | 'desconocido';
    preferredLanguage: 'es' | 'en';
    tags: string[];
  };
  state: ConversationState; // enum de la sección 3
  activeFlowId?: string;     // referencia al flujo guiado activo (sección 5)
  detectedIntent?: {
    label: string;           // "cotizar_evento", "agendar_clase", "queja", etc.
    confidence: number;
    entities: Record<string, string>; // { fecha: "2026-10-20", tipoEvento: "boda" }
  };
  lastInboundAt: string;   // ISO timestamp
  lastOutboundAt: string;
  summary: string;          // resumen corto generado/actualizado por Gemini, no el chat completo
  followUpEligibleAt?: string; // cuándo se vuelve candidato a re-engagement
  optedOut: boolean;        // U7 — nunca más sugerir seguimiento si es true
}
```

Retención: el resumen se regenera cada N mensajes (configurable, ej. cada 10) en vez de crecer indefinidamente. Se persiste en `data/conversation-context.json`, siguiendo el mismo patrón de persistencia JSON del resto del proyecto.

---

## 5. Motor de flujos guiados (configurable, sin hardcodear)

Estructura de un "flujo objetivo", editable desde el dashboard o directamente en JSON:

```json
{
  "id": "cotizacion_evento_hotelero",
  "label": "Cotización de evento en hotel",
  "appliesToRelationTypes": ["cliente_hotel", "desconocido"],
  "triggerIntents": ["cotizar_evento", "preguntar_disponibilidad"],
  "guidingQuestions": [
    "¿Qué tipo de evento es? (boda, gala, evento corporativo)",
    "¿Qué fecha tienen en mente?",
    "¿Cuántos invitados aproximadamente?"
  ],
  "successCondition": {
    "requiredEntities": ["tipoEvento", "fecha"],
    "onSuccess": "crear_cita_propuesta"
  },
  "abandonCondition": {
    "silenceHours": 48,
    "onAbandon": "sugerir_seguimiento"
  },
  "tone": "profesional_cordial"
}
```

El LLM (Gemini) recibe estas reglas como parte del **system prompt** de la conversación activa (no como código nuevo), junto con el resumen de contexto. Esto permite crear/editar flujos sin desplegar código, cumpliendo la regla de "no inventar capacidades fuera de lo configurable".

---

## 6. Entidad Cita

```typescript
interface Appointment {
  id: string;
  chatJid: string;
  contactName: string;
  type: string;            // "evento_hotelero", "clase", "reunion_institucional"
  proposedDate?: string;   // ISO date, si fue extraída de la conversación
  status: 'propuesta' | 'confirmada' | 'cancelada' | 'reagendada';
  sourceFlowId: string;    // qué flujo guiado la generó
  createdAt: string;
  confirmedBy?: string;    // usuario humano que confirmó
  notes?: string;
}
```

Persistencia inicial: `data/appointments.json`. La confirmación de una cita **siempre** requiere acción humana en el dashboard (el bot solo propone, nunca confirma solo).

---

## 7. Re-engagement (retomar conversaciones)

- Un job periódico (ej. cada hora) revisa `conversation-context.json` buscando chats con `lastInboundAt` mayor al `silenceHours` de su flujo activo, o sin flujo activo pero marcados como "lead" (`relationType` distinto de `desconocido` sin resolución).
- Genera una **sugerencia** de mensaje de seguimiento (vía Gemini, usando el resumen y el tono del contacto) y la coloca en una cola visible en el dashboard — reutilizando el patrón de `PendingAlertService` (cola + acción humana) en vez de crear un servicio paralelo.
- El mensaje **nunca se envía automáticamente**. Un humano lo aprueba, edita o descarta.
- Se respeta `optedOut` de forma permanente y las ventanas de mensajería de WhatsApp (ver sección 9).
- Rate limiting: mínimo 2s entre envíos (ya establecido en `CLAUDE.md`), y máximo N seguimientos por contacto por semana (configurable) para evitar percepción de spam.

---

## 8. Modelo de datos — resumen de entidades nuevas

| Entidad | Archivo JSON | Relación |
|---|---|---|
| `ConversationContext` | `data/conversation-context.json` | 1:1 con chat (`chatJid`) |
| `GuidedFlow` (config) | `data/guided-flows.json` | N flujos, referenciados por `activeFlowId` |
| `Appointment` | `data/appointments.json` | N:1 con chat |
| `FollowUpSuggestion` | integrado en `pending-alerts.json` como nuevo `type: 'follow_up'` (reutiliza cola existente) |

Diseñado para migrar limpio a tablas relacionales (`conversation_context`, `guided_flows`, `appointments`, `follow_up_suggestions`) si el proyecto pasa a una DB real en una fase posterior del roadmap.

---

## 9. Integraciones de terceros a evaluar (opciones, no decisión final)

| Necesidad | Opción A | Opción B | Consideración |
|---|---|---|---|
| LLM de análisis/guiado | Gemini (ya integrado) | Mantener solo Gemini por ahora | Evitar duplicar integraciones sin necesidad clara |
| Canal WhatsApp | Baileys (actual, no oficial) | WhatsApp Business Cloud API (Meta, oficial) | Baileys tiene riesgo de baneo en uso comercial intensivo; la API oficial impone ventana de 24h para mensajes de seguimiento fuera de plantilla — relevante para la sección 7 |
| Calendario | Sin integración (solo `Appointment` interno) | Google Calendar API | Depende de si el coordinador ya usa Calendar activamente |
| Métricas/CRM | Panel propio en el dashboard | Exportar a Google Sheets | Panel propio es más simple de mantener con el stack actual |

**Nota sobre WhatsApp Business Cloud API:** si el volumen de seguimientos crece, la ventana de 24h de la API oficial obliga a usar plantillas pre-aprobadas para reabrir conversación — esto afecta directamente el diseño de la sección 7 y debería resolverse en un ADR antes de implementar re-engagement a escala.

---

## 10. Seguridad y cumplimiento

- `optedOut` se respeta de forma permanente y se expone claramente en el dashboard.
- No se guardan datos personales sensibles más allá de lo necesario (nombre, tipo de relación, resumen de conversación).
- Los logs no incluyen el contenido completo de mensajes con datos personales identificables más allá de lo ya registrado por el sistema actual.
- Ninguna credencial (API key de Gemini, etc.) se hardcodea — se mantiene `process.env`.
- Todo envío automatizado de seguimiento pasa por aprobación humana (no hay excepción en esta fase).

---

## 11. Métricas de éxito

- Tasa de conversación → cita propuesta
- Tasa de cita propuesta → cita confirmada
- Tiempo medio hasta primera respuesta guiada
- Tasa de seguimientos sugeridos que son aprobados vs descartados por el humano
- Tasa de escalación a humano (no debería subir respecto al baseline actual)

---

## 12. Plan de fases

### Fase A — Fundación (no rompe nada existente)
- `ConversationContext` con perfil de contacto y resumen
- Detección de intención (extensión del análisis Gemini ya usado en `PendingAlertService`)
- Dashboard: vista de perfil de contacto por chat
- **Implementada como módulo hexagonal** en `src/modules/conversation-context/` (`domain/` lógica pura, `application/` casos de uso sobre un puerto de repositorio, `infrastructure/` adaptadores JSON y Express) — ver decisión en la sección 15. El resto del proyecto sigue con la arquitectura de servicios/singleton existente; esta convención no se impone todavía al resto del código.

### Fase B — Flujos guiados
- Motor de `GuidedFlow` (lectura de config JSON)
- Editor básico de flujos en el dashboard (crear/editar/activar)
- Máquina de estados de conversación
- **Implementada** como módulo hexagonal en `src/modules/guided-flows/`, siguiendo la misma convención de Fase A (sección 15):
  - `domain/GuidedFlow.ts` — entidad `GuidedFlow`, `FlowState` y lógica pura (selección de flujo por `relationType`+intención, fusión de entidades acumuladas, condición de éxito, siguiente pregunta guía).
  - `application/GuidedFlowService.ts` — CRUD de flujos (usado por el editor) + motor `evaluateMessage()` llamado desde `BotOrchestrator` en cada mensaje entrante.
  - `infrastructure/` — `JsonGuidedFlowRepository` (config en `data/guided-flows.json`), `JsonFlowStateRepository` (estado en tiempo de ejecución por chat en `data/guided-flow-state.json`, separado de la config) y el controller Express (`/api/guided-flows`).
  - El estado activo/entidades acumuladas se guarda como estado propio del módulo (`FlowState`), no dentro de `ConversationContext` de Fase A, para mantener los módulos desacoplados; `BotOrchestrator` es quien conecta ambos.
  - Cuando hay un flujo activo, su pregunta guía y tono se inyectan en el prompt de Gemini (sección 5) para que la respuesta se oriente hacia el objetivo sin salirse del guion.
  - **No implementado en esta fase:** el barrido de abandono por silencio (`abandonCondition.silenceHours`) — se evalúa solo en un mensaje entrante, que por definición no es silencio; el barrido periódico real es de Fase D (re-engagement). Tampoco se crea la `Appointment` al cumplir `successCondition`; por ahora solo se emite el evento `flow:success` con la acción configurada (`onSuccess`), a la espera de Fase C.

### Fase C — Citas
- Entidad `Appointment` + creación automática al cumplir `successCondition`
- Vista de citas propuestas/confirmadas en el dashboard
- **Implementada** como módulo hexagonal en `src/modules/appointments/`, mismo patrón de Fases A y B:
  - `domain/Appointment.ts` — entidad y transiciones puras (`createProposedAppointment`, `confirmAppointment`, `cancelAppointment`, `rescheduleAppointment`); toda cita nace en estado `propuesta`, nunca `confirmada`.
  - `application/AppointmentService.ts` — `createFromFlowSuccess()` (llamado desde `BotOrchestrator` cuando `GuidedFlowService` emite `flow:success` con `onSuccessAction === 'crear_cita_propuesta'`, usando `tipoEvento`/`fecha` de las entidades acumuladas del flujo) + `confirm`/`cancel`/`reschedule` para uso exclusivo del dashboard.
  - `infrastructure/` — `JsonAppointmentRepository` (`data/appointments.json`) y el controller Express (`/api/appointments`).
  - Página de dashboard **Citas** (`/appointments`) con filtro por estado y acciones de confirmar/cancelar/reagendar — siempre humanas; el bot nunca llama a `confirm()`.
  - Otros valores de `onSuccessAction` distintos de `crear_cita_propuesta` no tienen manejador todavía (se loguean); el spec deja `onSuccess` como string libre a propósito para futuras acciones.

### Fase D — Re-engagement
- Job de detección de silencio + cola de sugerencias (extensión de `pending-alerts.json`)
- Flujo de aprobación humana en el dashboard
- Rate limiting y respeto de `optedOut`

### Fase E — Evaluación de integraciones externas
- ADR sobre WhatsApp Business Cloud API vs Baileys si el volumen lo justifica
- ADR sobre integración de calendario externo

---

## 13. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Baneo del número por uso comercial vía Baileys | Rate limiting estricto ya vigente; evaluar migración a API oficial si crece el volumen (Fase E) |
| Falsos positivos de intención (bot "empuja" una cita quien solo preguntaba algo casual) | `successCondition` requiere entidades explícitas (fecha + tipo de evento), no solo intención |
| Seguimientos percibidos como spam | Aprobación humana obligatoria + límite semanal por contacto + respeto de opt-out |
| Crecimiento descontrolado del contexto guardado por chat | Resumen periódico en vez de historial completo (sección 4) |
| Config de flujos mal definida rompe la conversación | Validación de esquema JSON al cargar `guided-flows.json`, con fallback a Q&A normal si un flujo es inválido |

---

## 14. Próximos pasos

1. Revisar esta spec con el equipo (o el propio coordinador) y priorizar fases.
2. Escribir ADR para la decisión de Fase E (Baileys vs API oficial) antes de construir re-engagement a escala.
3. Iniciar Fase A como PR independiente, sin tocar el flujo de Q&A/escalación existente.

---

## 15. Decisión: arquitectura hexagonal para este módulo

**Estado:** Adoptada para Fase A. Alcance: solo `src/modules/conversation-context/`; el resto del proyecto (`BotOrchestrator`, `PendingAlertService`, `BotAssignmentService`, etc.) sigue con el patrón de servicios/singleton existente y no se migra en esta fase.

**Motivación:** este módulo introduce reglas de negocio nuevas (evolución del perfil de contacto, política de resumen acotado, opt-out permanente) que conviene poder probar sin `fs` ni Express, y que probablemente crecerán en las Fases B–D (flujos guiados, citas, re-engagement). Aislar el dominio detrás de un puerto de repositorio permite, más adelante, cambiar de JSON a una base de datos (sección 9) sin tocar la lógica de negocio ni los llamadores.

**Estructura:**
```
src/modules/conversation-context/
  domain/
    ConversationContext.ts   # entidad + funciones puras (createContext, recordInbound, updateProfile, ...)
    ports.ts                 # ConversationContextRepository (puerto de salida)
  application/
    ConversationContextService.ts  # casos de uso; único punto de entrada para los adaptadores conductores
  infrastructure/
    JsonConversationContextRepository.ts  # adaptador conducido (implementa el puerto sobre JSON)
    conversationContextController.ts      # adaptador conductor (Express); valida input HTTP
```
`BotOrchestrator` actúa como otro adaptador conductor (llama a `ConversationContextService.getInstance()` igual que a `PendingAlertService`), sin necesidad de conocer el dominio ni el repositorio.

**No decidido todavía:** si el resto del proyecto migra a este patrón. Se evaluará según cómo funcione en las Fases B–D antes de proponerlo como convención general (requeriría su propio ADR y una migración incremental, no un rewrite).
