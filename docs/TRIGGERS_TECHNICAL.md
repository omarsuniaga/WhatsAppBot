# 🏗️ Arquitectura Técnica: Sistema de Triggers

## 📋 Tabla de Contenidos
1. [Arquitectura General](#arquitectura-general)
2. [Componentes](#componentes)
3. [API Endpoints](#api-endpoints)
4. [Tipos de Datos](#tipos-de-datos)
5. [Flujo de Datos](#flujo-de-datos)
6. [Integración con BotService](#integración-con-botservice)
7. [Base de Datos](#base-de-datos)

---

## 🏛️ Arquitectura General

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (React)                         │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ TriggerManagement.tsx                                │  │
│  │ - CRUD UI                                            │  │
│  │ - Testing                                            │  │
│  │ - Estadísticas                                       │  │
│  └──────────────────────────────────────────────────────┘  │
│           ↓                                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ triggerApi (client.ts)                               │  │
│  │ - getAll(), getById(), create(), update(), delete() │  │
│  │ - toggleListener(), testMessage(), export()         │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
           ↕ HTTP REST
┌─────────────────────────────────────────────────────────────┐
│                BACKEND (Node.js/Express)                    │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Admin Routes (/api/triggers/*)                       │  │
│  │ - Protegidas con autenticación                       │  │
│  └──────────────────────────────────────────────────────┘  │
│           ↓                                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ triggersController.ts                               │  │
│  │ - getAll(), getById(), create(), update(), delete() │  │
│  │ - toggleListener(), testMessage(), export()         │  │
│  │ - getStats(), resetStats()                          │  │
│  └──────────────────────────────────────────────────────┘  │
│           ↓                                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ TriggerService.ts                                    │  │
│  │ - Lógica de negocio                                 │  │
│  │ - Matching (exact, contains, startsWith, regex)    │  │
│  │ - findMatchingTriggers(message)                      │  │
│  │ - getStats(), resetStats()                          │  │
│  └──────────────────────────────────────────────────────┘  │
│           ↓                                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ TriggerRepo.ts                                       │  │
│  │ - Persistencia en triggers.json                      │  │
│  │ - findActiveSorted(), recordMatch()                 │  │
│  └──────────────────────────────────────────────────────┘  │
│           ↓                                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ data/triggers.json                                   │  │
│  │ - Almacenamiento de triggers                         │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 🧩 Componentes

### Frontend Components

#### 1. **TriggerManagement.tsx**
Componente principal de gestión de triggers
```typescript
// Props
interface Props {
  // Sin props - singleton state
}

// Features
- CRUD operations
- Form validation
- Testing UI
- Statistics display
- Bulk operations
```

#### 2. **SettingsPanel.tsx**
Panel de configuración que integra TriggerManagement
```typescript
// Secciones
export type SettingsSection = 
  | 'general' 
  | 'api' 
  | 'notifications' 
  | 'import' 
  | 'groups' 
  | 'triggers'  // ← Nuevo
  | 'data';
```

#### 3. **ChatList.tsx**
Acceso directo a triggers en menú
```typescript
// En el menú desplegable
<button onClick={setShowSettingsPanel(true)}>
  <Zap className="w-5 h-5" />
  <span>Triggers</span>
</button>
```

### Backend Services

#### TriggerService (backend/src/services/)
```typescript
class TriggerService extends EventEmitter {
  // Configuración
  getConfig(): TriggerConfig
  setListenerEnabled(enabled: boolean): void
  setRequireTrigger(require: boolean): void

  // CRUD
  create(data: CreateTrigger): Promise<Trigger>
  getById(id: string): Promise<Trigger | null>
  getAll(activeOnly?: boolean): Promise<Trigger[]>
  update(id: string, updates: UpdateTrigger): Promise<Trigger>
  delete(id: string): Promise<void>
  toggle(id: string): Promise<Trigger>

  // Operaciones bulk
  enableAll(): Promise<void>
  disableAll(): Promise<void>
  import(triggers: CreateTrigger[]): Promise<Trigger[]>
  export(): Promise<Trigger[]>

  // Matching
  matchesTrigger(msg: string, trigger: Trigger): boolean
  findMatchingTriggers(msg: string): Promise<Trigger[]>
  testMessage(msg: string): Promise<TestResult>

  // Estadísticas
  getStats(): Promise<Stats>
  resetStats(): Promise<void>
}
```

#### TriggerRepo (backend/src/repos/)
```typescript
class TriggerRepo extends BaseRepository<Trigger> {
  // Queries
  findByKeyword(keyword: string): Promise<Trigger | null>
  findActive(): Promise<Trigger[]>
  findByCategory(category: string): Promise<Trigger[]>
  findSorted(): Promise<Trigger[]>
  findActiveSorted(): Promise<Trigger[]>

  // Stats
  recordMatch(id: string): Promise<void>
  resetStats(): Promise<void>

  // Validation
  isValidRegex(pattern: string): boolean
}
```

---

## 🔌 API Endpoints

Base URL: `/api/triggers`

### Configuración

```http
GET /api/triggers/config
Response: { listenerEnabled, requireTrigger }

POST /api/triggers/listener/toggle
Body: { enabled: boolean }

POST /api/triggers/require/toggle
Body: { require: boolean }

PUT /api/triggers/settings
Body: { settings: TriggerConfig['settings'] }
```

### CRUD

```http
GET /api/triggers?active=true
Response: { success, data: Trigger[], count }

GET /api/triggers/:id
Response: { success, data: Trigger }

POST /api/triggers
Body: {
  keyword: string
  matchType: 'exact' | 'contains' | 'startsWith' | 'regex'
  caseSensitive: boolean
  enabled: boolean
  description?: string
  category?: string
  priority: number
}
Response: { success, data: Trigger }

PUT /api/triggers/:id
Body: Partial<Omit<Trigger, 'id' | 'createdAt'>>
Response: { success, data: Trigger }

DELETE /api/triggers/:id
Response: { success, message }

POST /api/triggers/:id/toggle
Response: { success, data: Trigger }
```

### Bulk Operations

```http
POST /api/triggers/enable-all
Response: { success, data: Trigger[], message }

POST /api/triggers/disable-all
Response: { success, data: Trigger[], message }

POST /api/triggers/import
Body: { triggers: CreateTrigger[] }
Response: { success, data: Trigger[], count }

GET /api/triggers/export
Response: { success, data: Trigger[], count }
```

### Testing & Stats

```http
POST /api/triggers/test
Body: { message: string }
Response: { 
  success, 
  data: {
    matched: Trigger[]
    message: string
  }
}

GET /api/triggers/stats
Response: {
  success,
  data: {
    total: number
    active: number
    inactive: number
    byCategory: Record<string, number>
    byMatchType: Record<string, number>
  }
}

POST /api/triggers/stats/reset
Response: { success, message }
```

### Autenticación
- ✅ GET endpoints: Sin autenticación
- 🔐 POST/PUT/DELETE: Requieren `requireAdminAuth` middleware

---

## 📦 Tipos de Datos

### Domain Type: Trigger

```typescript
interface Trigger extends BaseEntity {
  id: string;                               // tgr_xxxxx
  keyword: string;                          // "hola", "info"
  matchType: 'exact' | 'contains' | 
            'startsWith' | 'regex';
  caseSensitive: boolean;
  enabled: boolean;
  description?: string;
  category?: string;
  priority: number;                         // 1-100
  matchCount?: number;                      // Stats
  lastMatchedAt?: number;                   // Unix timestamp
  createdAt: number;
  updatedAt: number;
}

type CreateTrigger = Omit<Trigger, 
  'id' | 'createdAt' | 'updatedAt' | 
  'matchCount' | 'lastMatchedAt'>;

type UpdateTrigger = Partial<Omit<Trigger, 
  'id' | 'createdAt' | 'updatedAt'>>;
```

### Frontend Type (client.ts)

```typescript
export interface Trigger {
  id: string;
  keyword: string;
  matchType: 'exact' | 'contains' | 'startsWith' | 'regex';
  caseSensitive: boolean;
  enabled: boolean;
  description?: string;
  category?: string;
  priority: number;
  createdAt: string;
  updatedAt: string;
}
```

---

## 🔄 Flujo de Datos

### Flow 1: Crear un Trigger

```
Usuario en UI
    ↓
TriggerManagement.handleAddTrigger()
    ↓
triggerApi.create(trigger)
    ↓
POST /api/triggers
    ↓
triggersController.create()
    ↓
TriggerService.create()
    ↓
Validar regex
    ↓
TriggerRepo.upsert()
    ↓
Guardar en triggers.json
    ↓
Emitir evento 'trigger:created'
    ↓
Actualizar lista en UI
```

### Flow 2: Probar Mensaje

```
Usuario ingresa mensaje en "Probador"
    ↓
handleTestMessage()
    ↓
triggerApi.testMessage(message)
    ↓
POST /api/triggers/test
    ↓
TriggerService.testMessage()
    ↓
Para cada trigger activo:
  - matchesTrigger(message, trigger)
  - Aplicar lógica según matchType
  - Registrar coincidencia
    ↓
Retornar { matched: Trigger[], message }
    ↓
Mostrar resultados en UI
```

### Flow 3: Los Triggers Activan Respuestas

```
Mensaje recibido en WhatsApp
    ↓
BotService.handleIncomingMessage()
    ↓
TriggerService.findMatchingTriggers(message)
    ↓
¿Hay coincidencias activas?
    ├─ SÍ → BotOrchestrator activa respuesta automática
    └─ NO → Mensaje se trata normalmente
    ↓
Respuesta automática se envía (KB + IA)
    ↓
Stats actualizadas
```

---

## 🤖 Integración con BotService

### En botService.ts (src/server/services/)

El servicio local de triggers **ya está integrado**:

```typescript
// Ya está implementado
import TriggerService from './triggerService';

class BotService {
  private triggerService: TriggerService;
  
  handleIncomingMessage(msg: string, jid: string) {
    // Verificar si el mensaje coincide con triggers
    const triggerCheck = this.triggerService
      .shouldActivateBot(msg, jid);
    
    if (!triggerCheck.activate) {
      console.log('Message skipped - no trigger match');
      return;
    }
    
    // Si hay coincidencia, procesar automáticamente
    console.log(`Triggers matched: ${triggerCheck.triggers
      .map(t => t.keyword).join(', ')}`);
    
    // Emitir evento al frontend
    this.io?.emit('trigger:matched', {
      message: msg,
      triggers: triggerCheck.triggers
    });
    
    // Procesar con BotOrchestrator
    // ...
  }
}
```

### Sincronización de Datos

**Local Service** ↔ **Backend API**

```
Frontend
  ↓
Backend TriggerService (CRUD + Persistencia)
  ↓
triggers.json (almacenamiento)
  ↓
BotService carga triggers al iniciar
  ↓
Local TriggerService sincronizado
```

---

## 💾 Base de Datos

### Archivo: data/triggers.json

```json
{
  "entities": [
    {
      "id": "tgr_abc123def456",
      "keyword": "hola",
      "matchType": "contains",
      "caseSensitive": false,
      "enabled": true,
      "description": "Saludo básico",
      "category": "greetings",
      "priority": 1,
      "matchCount": 42,
      "lastMatchedAt": 1706890123,
      "createdAt": 1706800000,
      "updatedAt": 1706890000
    },
    {
      "id": "tgr_xyz789uvw012",
      "keyword": "info|información",
      "matchType": "regex",
      "caseSensitive": false,
      "enabled": true,
      "description": "Solicitud de información",
      "category": "support",
      "priority": 2,
      "matchCount": 28,
      "lastMatchedAt": 1706889999,
      "createdAt": 1706800100,
      "updatedAt": 1706890000
    }
  ]
}
```

---

## 🔐 Seguridad

### Autenticación
- Solo admin puede crear/modificar triggers
- Endpoint de testing público (lectura)
- Export requiere autenticación

### Validación
- Regex pattern validation
- Keyword no vacío
- matchType validado
- Priority como número

### Rate Limiting
- Antecedentes del match por chat
- Cooldown para evitar spam
- Max triggers por mensaje

---

## 📊 Monitoreo

### Eventos Emitidos

```typescript
// En TriggerService
emit('listener:toggled', { enabled })
emit('trigger:created', trigger)
emit('trigger:updated', trigger)
emit('trigger:deleted', trigger)
emit('triggers:matched', { message, matched, triggers })
emit('triggers:enabledAll', count)
emit('triggers:disabledAll', count)
emit('triggers:imported', count)
emit('triggers:statsReset', {})
```

### Logs Disponibles

```
[TriggerService] Listener enabled
[TriggerService] Trigger created: hola
[TriggerService] Triggers matched: 2
[TriggerService] Stats reset
```

---

## 🚀 Próximos Pasos

1. **Migración desde TriggerService local**
   - Exportar triggers locales
   - Importarlos a backend
   - Sincronizar en tiempo real

2. **Persistencia en Base de Datos**
   - Migrar triggers.json → PostgreSQL
   - Índices en keyword y category

3. **Machine Learning**
   - Sugerencias automáticas de triggers
   - Análisis de frecuencia

4. **Webhooks**
   - Disparar eventos externos
   - Integración con APIs terceras

---

**Versión**: 1.0  
**Backend**: Node.js + Express + TypeScript  
**Frontend**: React + TypeScript  
**Storage**: FileStore JSON  
**Última actualización**: Febrero 2026
