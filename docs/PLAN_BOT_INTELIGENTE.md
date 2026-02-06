# Plan: Sistema de Bots Inteligentes con Gemini y Aprendizaje Continuo

## Resumen Ejecutivo

Sistema de asistentes virtuales asignables a contactos/grupos que responden usando Gemini + Knowledge Base, con escalación visual al dashboard cuando no pueden responder, y aprendizaje automático de las respuestas del usuario.

---

## 1. Arquitectura Propuesta

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React)                                │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────────┐  │
│  │  ChatView    │  │  AlertPanel  │  │  BotConfigPanel              │  │
│  │  + Alertas   │  │  (Sidebar)   │  │  - Asignar bot a chat        │  │
│  │    inline    │  │  - Tickets   │  │  - Configurar personalidad   │  │
│  │              │  │  - Pending   │  │  - Ver Knowledge Base        │  │
│  └──────────────┘  └──────────────┘  └──────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                              │ WebSocket
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         BACKEND (Node.js)                               │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    SmartBotOrchestrator                         │   │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌─────────────┐  │   │
│  │  │ KB Search │  │  Gemini   │  │ Escalation│  │  Learning   │  │   │
│  │  │  Agent    │  │  Agent    │  │  Agent    │  │   Agent     │  │   │
│  │  └───────────┘  └───────────┘  └───────────┘  └─────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                              │                                          │
│  ┌───────────────────────────┼──────────────────────────────────────┐  │
│  │                    Servicios Base                                 │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────┐   │  │
│  │  │ Knowledge   │  │  Escalation  │  │  PendingAlertService   │   │  │
│  │  │ BaseService │  │  Service     │  │  (NUEVO)               │   │  │
│  │  └─────────────┘  └──────────────┘  └────────────────────────┘   │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         STORAGE (JSON Files)                            │
├─────────────────────────────────────────────────────────────────────────┤
│  knowledge-base.json  │  escalation.json  │  pending-alerts.json (NEW)  │
│  bot-assignments.json (NEW)                                             │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Componentes a Desarrollar

### 2.1 Backend - Nuevos Servicios

#### A. PendingAlertService (NUEVO)
**Archivo:** `src/server/services/pendingAlertService.ts`

```typescript
interface PendingAlert {
    id: string;
    chatJid: string;
    customerName: string;
    customerPhone: string;
    originalMessage: string;
    conversationContext: Message[];

    // Análisis de Gemini
    geminiAnalysis: {
        intent: string;           // "consulta_precio", "queja", "soporte"
        suggestedTopics: string[]; // Temas relacionados en KB
        confidence: number;
        reason: string;           // Por qué no pudo responder
    };

    status: 'pending' | 'answered' | 'dismissed';
    priority: 'low' | 'medium' | 'high';

    // Respuesta del usuario
    userResponse?: string;
    respondedAt?: Date;
    respondedBy?: string;

    // Aprendizaje
    shouldLearn: boolean;        // ¿Agregar a KB?
    learnedFaqId?: string;

    createdAt: Date;
    expiresAt: Date;             // Auto-dismiss después de X tiempo
}
```

**Funcionalidades:**
- `createAlert(chatJid, message, geminiAnalysis)` - Crear alerta
- `getActiveAlerts()` - Obtener alertas pendientes
- `respondToAlert(alertId, response, shouldLearn)` - Responder y opcionalmente aprender
- `dismissAlert(alertId, reason)` - Descartar alerta
- `getAlertsByChat(chatJid)` - Alertas por chat

#### B. BotAssignmentService (NUEVO)
**Archivo:** `src/server/services/botAssignmentService.ts`

```typescript
interface BotAssignment {
    id: string;
    chatJid: string;
    chatName: string;
    isGroup: boolean;

    // Configuración del bot para este chat
    botConfig: {
        enabled: boolean;
        personality: 'professional' | 'friendly' | 'formal';
        language: string;
        customGreeting?: string;
        customFallback?: string;

        // Qué categorías de KB puede usar
        allowedCategories: string[];  // [] = todas

        // Límites
        maxResponseLength: number;
        responseDelayMs: number;

        // Comportamiento
        autoEscalate: boolean;        // Crear alerta si no puede responder
        escalateThreshold: number;    // Confianza mínima (0.5)
        learningEnabled: boolean;     // Aprender de respuestas
    };

    // Estadísticas
    stats: {
        totalMessages: number;
        autoResponses: number;
        escalations: number;
        learnedResponses: number;
    };

    createdAt: Date;
    updatedAt: Date;
}
```

#### C. LearningService (NUEVO)
**Archivo:** `src/server/services/learningService.ts`

```typescript
interface LearnedResponse {
    id: string;
    sourceAlertId: string;
    originalQuestion: string;
    userResponse: string;

    // Procesamiento
    extractedQuestions: string[];    // Variaciones generadas por Gemini
    extractedKeywords: string[];
    suggestedCategory: string;

    // Estado
    status: 'pending_review' | 'approved' | 'rejected';
    reviewedBy?: string;
    reviewedAt?: Date;

    // Si se aprobó
    createdFaqId?: string;

    createdAt: Date;
}
```

**Funcionalidades:**
- `learnFromResponse(alertId, userResponse)` - Procesar respuesta para aprendizaje
- `generateQuestionVariations(question)` - Usar Gemini para generar variaciones
- `extractKeywords(text)` - Extraer palabras clave
- `suggestCategory(question, answer)` - Sugerir categoría
- `approveLearnedResponse(id)` - Aprobar y crear FAQ
- `rejectLearnedResponse(id, reason)` - Rechazar

### 2.2 Backend - Modificaciones a Servicios Existentes

#### A. BotOrchestrator - Modificar
**Archivo:** `src/agents/BotOrchestrator.ts`

**Cambios:**
1. Verificar asignación de bot antes de procesar
2. Usar configuración específica del chat
3. Crear alerta cuando no puede responder (en lugar de fallback genérico)

```typescript
async processMessage(jid: string, message: string, isGroup: boolean) {
    // 1. Verificar asignación
    const assignment = await botAssignmentService.getAssignment(jid);
    if (!assignment?.botConfig.enabled) {
        return null;
    }

    // 2. Buscar en KB (con categorías permitidas)
    const kbResult = await this.searchKnowledge(message, assignment.botConfig.allowedCategories);

    if (kbResult.confidence >= assignment.botConfig.escalateThreshold) {
        return this.formatResponse(kbResult.answer, assignment.botConfig);
    }

    // 3. Intentar Gemini
    const geminiResult = await this.tryGemini(message, assignment.botConfig);

    if (geminiResult.canAnswer) {
        return this.formatResponse(geminiResult.answer, assignment.botConfig);
    }

    // 4. NO puede responder → Crear alerta (no fallback genérico)
    if (assignment.botConfig.autoEscalate) {
        await pendingAlertService.createAlert(jid, message, geminiResult.analysis);

        // Emitir evento para frontend
        this.emit('alert:new', {
            chatJid: jid,
            message: message,
            analysis: geminiResult.analysis
        });

        // Mensaje temporal al cliente
        return assignment.botConfig.customFallback ||
            "Un momento, estoy consultando con mi equipo para darte la mejor respuesta.";
    }

    return null;
}
```

#### B. KnowledgeBaseService - Modificar

**Cambios:**
1. Filtrar por categorías permitidas
2. Método para agregar FAQ desde aprendizaje

```typescript
// Nuevo método
async addLearnedFaq(learnedResponse: LearnedResponse): Promise<FAQ> {
    const faq: FAQ = {
        id: generateId(),
        category: learnedResponse.suggestedCategory,
        questions: learnedResponse.extractedQuestions,
        answer: learnedResponse.userResponse,
        keywords: learnedResponse.extractedKeywords,
        confidence: 0.9,  // Alta confianza (respuesta humana)
        usageCount: 0,
        createdBy: 'ai_learned',
        approved: true,   // Ya fue aprobado en el proceso de aprendizaje
        createdAt: new Date(),
        updatedAt: new Date()
    };

    this.data.faqs.push(faq);
    await this.save();

    return faq;
}

// Modificar search para filtrar categorías
async search(query: string, allowedCategories?: string[]): Promise<SearchResult[]> {
    let faqs = this.data.faqs;

    if (allowedCategories && allowedCategories.length > 0) {
        faqs = faqs.filter(f => allowedCategories.includes(f.category));
    }

    // ... resto del algoritmo de búsqueda
}
```

### 2.3 Frontend - Nuevos Componentes

#### A. AlertPanel (Sidebar)
**Archivo:** `web/src/components/alerts/AlertPanel.tsx`

```tsx
const AlertPanel = () => {
    const [alerts, setAlerts] = useState<PendingAlert[]>([]);
    const [selectedAlert, setSelectedAlert] = useState<PendingAlert | null>(null);

    // Escuchar WebSocket para nuevas alertas
    useEffect(() => {
        socket.on('alert:new', (alert) => {
            setAlerts(prev => [alert, ...prev]);
            // Notificación visual/sonora
            playNotificationSound();
            showToast(`Nueva consulta de ${alert.customerName}`);
        });
    }, []);

    return (
        <div className="alert-panel">
            <div className="alert-header">
                <Bell className="icon" />
                <span>Consultas Pendientes</span>
                <Badge count={alerts.length} />
            </div>

            <div className="alert-list">
                {alerts.map(alert => (
                    <AlertCard
                        key={alert.id}
                        alert={alert}
                        onClick={() => setSelectedAlert(alert)}
                    />
                ))}
            </div>

            {selectedAlert && (
                <AlertResponseModal
                    alert={selectedAlert}
                    onRespond={handleRespond}
                    onDismiss={handleDismiss}
                />
            )}
        </div>
    );
};
```

#### B. AlertCard
**Archivo:** `web/src/components/alerts/AlertCard.tsx`

```tsx
const AlertCard = ({ alert, onClick }) => (
    <div
        className={`alert-card priority-${alert.priority}`}
        onClick={onClick}
    >
        <div className="alert-header">
            <Avatar name={alert.customerName} />
            <div className="alert-info">
                <span className="customer-name">{alert.customerName}</span>
                <span className="time">{formatRelativeTime(alert.createdAt)}</span>
            </div>
            <PriorityBadge priority={alert.priority} />
        </div>

        <p className="alert-message">{alert.originalMessage}</p>

        <div className="alert-analysis">
            <Tag>{alert.geminiAnalysis.intent}</Tag>
            <span className="reason">{alert.geminiAnalysis.reason}</span>
        </div>

        {alert.geminiAnalysis.suggestedTopics.length > 0 && (
            <div className="suggested-topics">
                <span>Temas relacionados:</span>
                {alert.geminiAnalysis.suggestedTopics.map(topic => (
                    <Chip key={topic}>{topic}</Chip>
                ))}
            </div>
        )}
    </div>
);
```

#### C. AlertResponseModal
**Archivo:** `web/src/components/alerts/AlertResponseModal.tsx`

```tsx
const AlertResponseModal = ({ alert, onRespond, onDismiss }) => {
    const [response, setResponse] = useState('');
    const [shouldLearn, setShouldLearn] = useState(true);
    const [suggestedResponses, setSuggestedResponses] = useState<string[]>([]);

    // Obtener sugerencias de Gemini basadas en KB
    useEffect(() => {
        fetchSuggestedResponses(alert).then(setSuggestedResponses);
    }, [alert]);

    return (
        <Modal>
            <div className="modal-header">
                <h3>Responder a {alert.customerName}</h3>
                <PriorityBadge priority={alert.priority} />
            </div>

            {/* Contexto de la conversación */}
            <div className="conversation-context">
                <h4>Contexto</h4>
                {alert.conversationContext.map(msg => (
                    <MessageBubble key={msg.id} message={msg} />
                ))}
                <div className="current-message highlight">
                    <strong>Mensaje actual:</strong>
                    <p>{alert.originalMessage}</p>
                </div>
            </div>

            {/* Análisis de Gemini */}
            <div className="gemini-analysis">
                <h4>Análisis</h4>
                <p><strong>Intención:</strong> {alert.geminiAnalysis.intent}</p>
                <p><strong>Razón de escalación:</strong> {alert.geminiAnalysis.reason}</p>
            </div>

            {/* Respuestas sugeridas */}
            {suggestedResponses.length > 0 && (
                <div className="suggested-responses">
                    <h4>Respuestas sugeridas</h4>
                    {suggestedResponses.map((suggestion, i) => (
                        <button
                            key={i}
                            className="suggestion-btn"
                            onClick={() => setResponse(suggestion)}
                        >
                            {suggestion}
                        </button>
                    ))}
                </div>
            )}

            {/* Input de respuesta */}
            <textarea
                value={response}
                onChange={e => setResponse(e.target.value)}
                placeholder="Escribe tu respuesta..."
                rows={4}
            />

            {/* Opción de aprendizaje */}
            <label className="learn-checkbox">
                <input
                    type="checkbox"
                    checked={shouldLearn}
                    onChange={e => setShouldLearn(e.target.checked)}
                />
                <span>Agregar a base de conocimiento para futuras consultas similares</span>
            </label>

            {/* Acciones */}
            <div className="modal-actions">
                <button onClick={() => onDismiss(alert.id)} className="btn-secondary">
                    Descartar
                </button>
                <button
                    onClick={() => onRespond(alert.id, response, shouldLearn)}
                    className="btn-primary"
                    disabled={!response.trim()}
                >
                    Enviar Respuesta
                </button>
            </div>
        </Modal>
    );
};
```

#### D. BotAssignmentPanel
**Archivo:** `web/src/components/bot/BotAssignmentPanel.tsx`

```tsx
const BotAssignmentPanel = ({ chatJid, chatName }) => {
    const [assignment, setAssignment] = useState<BotAssignment | null>(null);
    const [categories, setCategories] = useState<Category[]>([]);

    return (
        <div className="bot-assignment-panel">
            <h3>Configuración del Bot</h3>

            {/* Toggle principal */}
            <div className="setting-row">
                <label>Bot activo para este chat</label>
                <Toggle
                    checked={assignment?.botConfig.enabled}
                    onChange={handleToggle}
                />
            </div>

            {assignment?.botConfig.enabled && (
                <>
                    {/* Personalidad */}
                    <div className="setting-row">
                        <label>Personalidad</label>
                        <Select
                            value={assignment.botConfig.personality}
                            onChange={handlePersonalityChange}
                            options={[
                                { value: 'professional', label: 'Profesional' },
                                { value: 'friendly', label: 'Amigable' },
                                { value: 'formal', label: 'Formal' }
                            ]}
                        />
                    </div>

                    {/* Categorías permitidas */}
                    <div className="setting-row">
                        <label>Categorías de conocimiento</label>
                        <MultiSelect
                            value={assignment.botConfig.allowedCategories}
                            onChange={handleCategoriesChange}
                            options={categories.map(c => ({ value: c.id, label: c.name }))}
                            placeholder="Todas las categorías"
                        />
                    </div>

                    {/* Umbral de escalación */}
                    <div className="setting-row">
                        <label>Umbral de confianza para responder</label>
                        <Slider
                            value={assignment.botConfig.escalateThreshold}
                            onChange={handleThresholdChange}
                            min={0.3}
                            max={0.9}
                            step={0.1}
                        />
                        <span>{(assignment.botConfig.escalateThreshold * 100).toFixed(0)}%</span>
                    </div>

                    {/* Auto-escalación */}
                    <div className="setting-row">
                        <label>Crear alerta cuando no pueda responder</label>
                        <Toggle
                            checked={assignment.botConfig.autoEscalate}
                            onChange={handleAutoEscalateChange}
                        />
                    </div>

                    {/* Aprendizaje */}
                    <div className="setting-row">
                        <label>Aprender de mis respuestas</label>
                        <Toggle
                            checked={assignment.botConfig.learningEnabled}
                            onChange={handleLearningChange}
                        />
                    </div>

                    {/* Mensaje personalizado de espera */}
                    <div className="setting-row">
                        <label>Mensaje cuando escala</label>
                        <textarea
                            value={assignment.botConfig.customFallback}
                            onChange={handleFallbackChange}
                            placeholder="Un momento, estoy consultando..."
                        />
                    </div>

                    {/* Estadísticas */}
                    <div className="stats-section">
                        <h4>Estadísticas</h4>
                        <div className="stats-grid">
                            <StatCard
                                label="Mensajes"
                                value={assignment.stats.totalMessages}
                            />
                            <StatCard
                                label="Respuestas auto"
                                value={assignment.stats.autoResponses}
                                percentage={(assignment.stats.autoResponses / assignment.stats.totalMessages * 100).toFixed(1)}
                            />
                            <StatCard
                                label="Escalaciones"
                                value={assignment.stats.escalations}
                            />
                            <StatCard
                                label="Aprendidas"
                                value={assignment.stats.learnedResponses}
                            />
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
```

#### E. Integración en ChatView
**Modificar:** `web/src/components/chat/ChatView.tsx`

```tsx
// Agregar indicador de alerta pendiente en el header
{hasPendingAlert && (
    <button
        onClick={() => setShowAlertModal(true)}
        className="pending-alert-indicator"
    >
        <AlertCircle className="icon pulse" />
        <span>Consulta pendiente</span>
    </button>
)}

// Agregar botón de configuración de bot
<button
    onClick={() => setShowBotConfig(true)}
    className="bot-config-btn"
>
    <Settings className="icon" />
</button>
```

### 2.4 Backend - Nuevas Rutas API

**Archivo:** `src/server/routes/index.ts`

```typescript
// Alertas
router.get('/alerts', alertController.getAlerts);
router.get('/alerts/:id', alertController.getAlert);
router.post('/alerts/:id/respond', alertController.respondToAlert);
router.post('/alerts/:id/dismiss', alertController.dismissAlert);

// Asignaciones de bot
router.get('/bot-assignments', botAssignmentController.getAll);
router.get('/bot-assignments/:jid', botAssignmentController.getByJid);
router.post('/bot-assignments', botAssignmentController.create);
router.put('/bot-assignments/:jid', botAssignmentController.update);
router.delete('/bot-assignments/:jid', botAssignmentController.delete);

// Aprendizaje
router.get('/learning/pending', learningController.getPending);
router.post('/learning/:id/approve', learningController.approve);
router.post('/learning/:id/reject', learningController.reject);
```

### 2.5 WebSocket Events

```typescript
// Nuevos eventos a emitir
socket.emit('alert:new', alert);           // Nueva alerta creada
socket.emit('alert:updated', alert);       // Alerta respondida/descartada
socket.emit('learning:new', learned);      // Nueva respuesta aprendida
socket.emit('learning:approved', faq);     // FAQ creada desde aprendizaje
```

---

## 3. Flujo de Datos Completo

### Caso 1: Mensaje que el bot puede responder

```
1. Cliente envía: "¿Cuál es el horario?"
   ↓
2. BotOrchestrator recibe mensaje
   ↓
3. Verificar asignación de bot para este chat ✓
   ↓
4. Buscar en KnowledgeBase
   → Encontrado: "Atendemos de 9AM a 6PM"
   → Confianza: 0.95 (> threshold 0.7)
   ↓
5. Formatear respuesta según personalidad del bot
   ↓
6. Enviar respuesta al cliente
   ↓
7. Actualizar estadísticas (autoResponses++)
```

### Caso 2: Mensaje que requiere escalación

```
1. Cliente envía: "¿Hacen envíos a Marte?"
   ↓
2. BotOrchestrator recibe mensaje
   ↓
3. Verificar asignación de bot ✓
   ↓
4. Buscar en KnowledgeBase
   → No encontrado (confianza: 0.2)
   ↓
5. Intentar Gemini
   → Análisis: {
       canAnswer: false,
       intent: "consulta_envio",
       reason: "No hay información sobre envíos interplanetarios",
       suggestedTopics: ["envíos nacionales", "envíos internacionales"]
     }
   ↓
6. Crear PendingAlert
   ↓
7. Emitir 'alert:new' por WebSocket
   ↓
8. Enviar mensaje temporal: "Un momento, consulto con mi equipo..."
   ↓
9. Dashboard muestra alerta con:
   - Mensaje original
   - Análisis de Gemini
   - Sugerencias de respuesta
   ↓
10. Usuario responde: "Actualmente solo hacemos envíos nacionales e internacionales"
    ↓
11. Si "shouldLearn" = true:
    → Gemini genera variaciones de pregunta
    → Extraer keywords
    → Sugerir categoría
    → Crear LearnedResponse (pending_review)
    ↓
12. Enviar respuesta al cliente
    ↓
13. Actualizar estadísticas (escalations++)
```

### Caso 3: Aprendizaje automático

```
1. LearnedResponse creada con:
   - originalQuestion: "¿Hacen envíos a Marte?"
   - userResponse: "Solo envíos nacionales e internacionales"
   ↓
2. Gemini procesa:
   - extractedQuestions: [
       "¿Hacen envíos a Marte?",
       "¿Envían a otros planetas?",
       "¿Tienen envíos espaciales?",
       "¿Llegan a destinos fuera de la Tierra?"
     ]
   - extractedKeywords: ["envíos", "marte", "planetas", "espacial"]
   - suggestedCategory: "Envíos"
   ↓
3. Si autoApprove = true:
   → Crear FAQ automáticamente

   Si autoApprove = false:
   → Mostrar en panel de revisión
   → Admin aprueba/rechaza
   ↓
4. FAQ creada y disponible para futuras consultas
```

---

## 4. Modelo de Datos en JSON

### bot-assignments.json
```json
{
  "version": 1,
  "assignments": [
    {
      "id": "assign-001",
      "chatJid": "5491155551234@s.whatsapp.net",
      "chatName": "Juan Pérez",
      "isGroup": false,
      "botConfig": {
        "enabled": true,
        "personality": "friendly",
        "language": "es",
        "customGreeting": "¡Hola! Soy el asistente virtual.",
        "customFallback": "Dame un momento para consultar...",
        "allowedCategories": ["general", "productos"],
        "maxResponseLength": 500,
        "responseDelayMs": 1500,
        "autoEscalate": true,
        "escalateThreshold": 0.7,
        "learningEnabled": true
      },
      "stats": {
        "totalMessages": 150,
        "autoResponses": 120,
        "escalations": 25,
        "learnedResponses": 5
      },
      "createdAt": "2025-01-20T10:00:00Z",
      "updatedAt": "2025-01-26T15:30:00Z"
    }
  ]
}
```

### pending-alerts.json
```json
{
  "version": 1,
  "alerts": [
    {
      "id": "alert-001",
      "chatJid": "5491155551234@s.whatsapp.net",
      "customerName": "Juan Pérez",
      "customerPhone": "5491155551234",
      "originalMessage": "¿Hacen envíos a Marte?",
      "conversationContext": [
        {"role": "customer", "message": "Hola", "timestamp": "..."},
        {"role": "bot", "message": "¡Hola! ¿En qué puedo ayudarte?", "timestamp": "..."},
        {"role": "customer", "message": "¿Hacen envíos a Marte?", "timestamp": "..."}
      ],
      "geminiAnalysis": {
        "intent": "consulta_envio",
        "suggestedTopics": ["envíos nacionales", "envíos internacionales"],
        "confidence": 0.15,
        "reason": "No hay información sobre envíos interplanetarios en la base de conocimiento"
      },
      "status": "pending",
      "priority": "medium",
      "shouldLearn": true,
      "createdAt": "2025-01-26T16:00:00Z",
      "expiresAt": "2025-01-27T16:00:00Z"
    }
  ]
}
```

---

## 5. Cronograma de Implementación

### Fase 1: Backend Core (3-4 días)
- [ ] PendingAlertService
- [ ] BotAssignmentService
- [ ] LearningService
- [ ] Modificar BotOrchestrator
- [ ] Nuevas rutas API

### Fase 2: Frontend Alertas (2-3 días)
- [ ] AlertPanel (sidebar)
- [ ] AlertCard
- [ ] AlertResponseModal
- [ ] Integración WebSocket

### Fase 3: Frontend Configuración (2 días)
- [ ] BotAssignmentPanel
- [ ] Integración en ChatView header
- [ ] Settings por chat

### Fase 4: Aprendizaje (2 días)
- [ ] LearningReviewPanel
- [ ] Generación de variaciones con Gemini
- [ ] Auto-creación de FAQs

### Fase 5: Testing y Refinamiento (2 días)
- [ ] Tests de integración
- [ ] Ajuste de prompts de Gemini
- [ ] UX polish

**Total estimado: 11-13 días de desarrollo**

---

## 6. Prompts de Gemini Optimizados

### Análisis de Mensaje
```
Eres un analizador de intenciones para un asistente virtual.

CONTEXTO DEL NEGOCIO:
{businessDescription}

BASE DE CONOCIMIENTO DISPONIBLE:
{knowledgeBaseSummary}

HISTORIAL DE CONVERSACIÓN:
{conversationHistory}

MENSAJE A ANALIZAR:
"{message}"

Responde en JSON:
{
  "can_answer": boolean,      // ¿Puedes responder con la KB disponible?
  "confidence": 0.0-1.0,      // Confianza en tu capacidad de responder
  "intent": string,           // Intención del usuario (máx 3 palabras)
  "suggested_topics": [],     // Temas de KB relacionados
  "reason": string,           // Si can_answer=false, explica por qué
  "suggested_response": string // Si can_answer=true, tu respuesta
}
```

### Generación de Variaciones de Pregunta
```
Genera variaciones de la siguiente pregunta que un cliente podría hacer.
Las variaciones deben ser naturales y en español.

PREGUNTA ORIGINAL:
"{question}"

RESPUESTA PROPORCIONADA:
"{answer}"

Genera 5 variaciones diferentes de cómo un cliente podría preguntar lo mismo.
Incluye variaciones coloquiales, formales y con errores típicos de escritura.

Responde en JSON:
{
  "variations": ["var1", "var2", "var3", "var4", "var5"],
  "keywords": ["keyword1", "keyword2", ...],
  "suggested_category": "nombre_categoria"
}
```

---

## 7. Consideraciones de Seguridad

1. **Rate Limiting**: Limitar creación de alertas por chat (máx 5/hora)
2. **Validación**: Sanitizar respuestas antes de agregar a KB
3. **Auditoría**: Log de todas las respuestas aprendidas
4. **Rollback**: Poder deshacer FAQs aprendidas
5. **Permisos**: Solo admins pueden aprobar aprendizajes

---

## 8. Métricas y KPIs

### Dashboard de Métricas
- **Tasa de resolución automática**: autoResponses / totalMessages
- **Tiempo promedio de respuesta a escalaciones**
- **FAQs más utilizadas**
- **Categorías con más gaps** (más escalaciones)
- **Efectividad del aprendizaje**: learnedResponses utilizadas

---

## 9. Próximos Pasos Inmediatos

1. **Revisar y aprobar este plan**
2. **Crear estructura de archivos base**
3. **Implementar PendingAlertService**
4. **Implementar BotAssignmentService**
5. **Crear componente AlertPanel básico**
6. **Conectar WebSocket para alertas en tiempo real**

---

*Documento creado: 2025-01-26*
*Versión: 1.0*
