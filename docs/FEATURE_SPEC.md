# FEATURE_SPEC.md
**WhatsApp Bot Manager — Sistema Punta Cana**  
Especificación funcional y técnica (Fase Local JSON → Migración Firestore)

---

## 0. Objetivo del documento

Definir, de forma clara y escalable, el comportamiento esperado del **Dashboard** y de cada acción/botón principal, incluyendo:
- Flujos de UI/UX
- Modelos de datos (entidades mínimas)
- Rutas de frontend
- APIs del backend (Express)
- Persistencia local (JSON files)
- Automatizaciones seguras (borradores → confirmación → envío)
- Bitácora/auditoría (EventLog)

Este documento sirve como contrato para que cualquier agente de IA (Claude/ChatGPT/Copilot/Qwen) implemente módulos sin inventar reglas.

---

## 1. Principios de diseño

### 1.1 Capas del sistema
1) **Dominio institucional**: alumnos, contactos, clases, horarios, sesiones, asistencia, eventos.  
2) **Canal WhatsApp**: chats, grupos, envío/recepción, estado bot.  
3) **Automatizaciones**: reglas, borradores, confirmación, ejecución, auditoría.

### 1.2 Regla de seguridad
✅ **No enviar mensajes automáticos sin confirmación del staff** (en fase local).  
Todo flujo automático genera primero **DraftMessage**.

### 1.3 Persistencia local
La fuente de verdad vive en el backend:
- `/backend/data/*.json`  
El frontend **no** es fuente de verdad.

### 1.4 Auditoría obligatoria
Todo cambio crítico y toda acción automática crea un registro en `EventLog`:
- creación/edición de eventos
- generación de borradores
- envío de mensajes (éxito/fallo)
- cambios de asistencia

---

## 2. Mapa de Rutas (Frontend)

### 2.1 Rutas principales
| Ruta | Descripción |
|------|-------------|
| `/dashboard` | Dashboard principal (home) |
| `/whatsapp` | Gestión WhatsApp (chats, grupos, difusión, bot status) |
| `/knowledge` | Base de Conocimiento (FAQ + MD) |
| `/support` | Tickets de soporte (respuestas pendientes) |
| `/broadcast` | Difusión masiva (campañas) |
| `/settings` | Configuración (tono IA, plantillas default, admins) |

### 2.2 Gestión institucional
| Ruta | Descripción |
|------|-------------|
| `/attendance` | Asistencias (Hoy / Reporte / Automatizaciones) |
| `/students` | Alumnos (lista + crear + detalle) |
| `/classes` | Clases (class groups + enrollments) |
| `/schedule` | Horarios (vista semanal + publicar) |
| `/events` | Eventos (lista/mes) |
| `/events/new` | Nuevo Evento |
| `/events/:id` | Detalle Evento (recordatorios, destinatarios, borradores, log) |

### 2.3 Configuración
| Ruta | Descripción |
|------|-------------|
| `/templates` | Plantillas de mensajes |
| `/contacts` | Contactos (representantes) |
| `/teachers` | Profesores |
| `/drafts` | Borradores pendientes |
| `/tickets` | Respuestas pendientes |

---

## 3. Entidades (Modelos de Datos)

> **Nota**: Todas las entidades incluyen: `id`, `createdAt`, `updatedAt`.  
> Timestamps en unix seconds.

### 3.0 Diagrama de Relaciones

```
┌─────────────┐     M:N      ┌─────────────┐     M:N      ┌─────────────┐
│   Teacher   │◄────────────►│  ClassGroup │◄────────────►│   Student   │
│  (Maestro)  │  teacherIds  │   (Clase)   │  Enrollment  │   (Alumno)  │
└─────────────┘              └─────────────┘              └─────────────┘
      │                            │                            │
      │                            │ 1:N                        │
      │                      ┌─────▼─────┐                      │
      │                      │  Session  │                      │
      │                      │ (Sesión)  │                      │
      │                      └─────┬─────┘                      │
      │                            │ 1:N                        │
      │                      ┌─────▼─────┐                      │
      └──────────────────────┤Attendance ├──────────────────────┘
                             │ (Asist.)  │
                             └───────────┘
```

**Relaciones clave:**
| Entidad A | Relación | Entidad B | Implementación |
|-----------|----------|-----------|----------------|
| ClassGroup | M:N | Teacher | `ClassGroup.teacherIds[]` |
| ClassGroup | M:N | Student | Tabla `Enrollment` |
| ClassGroup | 1:N | Session | `Session.classGroupId` |
| ClassGroup | 1:N | Room/Location | `ClassSchedule[].location` |
| Session | M:N | Teacher | `Session.teacherIds[]` |
| Session | 1:N | Attendance | `AttendanceRecord.sessionId` |
| Student | 1:N | Attendance | `AttendanceRecord.studentId` |
| Contact | 1:N | Student | `Contact.studentIds[]` (representantes) |

### 3.1 Contact (representante/staff)
```ts
interface Contact {
  id: string;                    // ct_xxx
  firstName: string;
  lastName: string;
  displayName?: string;          // WhatsApp pushName
  phones: string[];              // Normalizados E.164
  preferredPhone?: string;
  email?: string;
  type: 'guardian' | 'teacher' | 'staff' | 'other';
  status: 'active' | 'inactive';
  studentIds: string[];          // Alumnos relacionados
  whatsappJid?: string;
  lastWhatsAppContact?: number;
  notes?: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}
```

### 3.2 Student (alumno)
```ts
interface Student {
  id: string;                    // st_xxx
  firstName: string;
  lastName: string;
  dateOfBirth?: string;          // YYYY-MM-DD
  program: 'orquesta' | 'coro' | 'iniciacion' | 'preparatoria';
  instrument?: string;
  level: string;                 // "Nivel 0", "Nivel 1", etc.
  status: 'active' | 'inactive' | 'graduated';
  contactIds: string[];          // Representantes
  enrollmentIds: string[];       // Inscripciones activas
  notes?: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}
```

### 3.3 ClassGroup (clase/grupo)
```ts
interface ClassGroup {
  id: string;                    // cl_xxx
  name: string;
  program: string;
  level: string;
  teacherId: string;
  room?: string;
  capacity?: number;
  schedules: Schedule[];
  waGroupJid?: string;           // Grupo WhatsApp vinculado
  botEnabled: boolean;
  status: 'active' | 'inactive';
  createdAt: number;
  updatedAt: number;
}

interface Schedule {
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  startTime: string;             // HH:mm
  endTime: string;               // HH:mm
}
```

### 3.4 Enrollment (inscripción)
```ts
interface Enrollment {
  id: string;                    // en_xxx
  studentId: string;
  classGroupId: string;
  enrolledAt: string;            // YYYY-MM-DD
  status: 'active' | 'withdrawn' | 'completed';
  notes?: string;
  createdAt: number;
  updatedAt: number;
}
```

### 3.5 Session (sesión de clase)
```ts
interface Session {
  id: string;                    // ss_xxx
  classGroupId: string;
  date: string;                  // YYYY-MM-DD
  scheduledStart: string;        // HH:mm
  scheduledEnd: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  teacherIds: string[];
  notes?: string;
  createdAt: number;
  updatedAt: number;
}
```

### 3.6 AttendanceRecord (asistencia)
```ts
interface AttendanceRecord {
  id: string;                    // ar_xxx
  sessionId: string;
  studentId: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  note?: string;
  markedBy: string;              // userId o 'system'
  markedAt: number;
  guardianNotified: boolean;
  notifiedAt?: number;
  createdAt: number;
  updatedAt: number;
}
```

### 3.7 Event (evento institucional)
```ts
interface Event {
  id: string;                    // ev_xxx
  title: string;
  type: 'rehearsal' | 'concert' | 'meeting' | 'masterclass' | 'audition' | 'admin' | 'other';
  date: string;                  // YYYY-MM-DD
  startTime: string;             // HH:mm
  endTime?: string;
  location?: string;
  description?: string;
  
  // Destinatarios
  targetPrograms: string[];
  targetClassGroupIds: string[];
  targetWaGroupJids: string[];
  targetContactIds: string[];
  
  // Recordatorios
  enableReminders: boolean;
  templateId?: string;
  reminders: EventReminder[];
  preferredSendTime?: string;    // HH:mm
  sendMode: 'draft' | 'auto';    // default: 'draft'
  
  status: 'scheduled' | 'completed' | 'cancelled';
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

interface EventReminder {
  id: string;
  eventId: string;
  triggerAt: number;             // Unix timestamp
  offsetMinutes: number;         // -1440 = 24h antes
  status: 'pending' | 'draft_created' | 'sent' | 'failed';
  draftId?: string;
  sentAt?: number;
  createdAt: number;
}
```

### 3.8 DraftMessage (borrador)
```ts
interface DraftMessage {
  id: string;                    // dr_xxx
  
  // Destino
  targetType: 'contact' | 'group';
  targetJid: string;
  targetName: string;
  targetPhone?: string;
  
  // Contenido
  message: string;
  templateId?: string;
  variables?: Record<string, string>;
  
  // Origen
  source: 'attendance' | 'event' | 'schedule' | 'manual' | 'ticket';
  sourceId?: string;
  
  // Estado
  status: 'pending' | 'approved' | 'sent' | 'failed' | 'cancelled';
  approvedBy?: string;
  approvedAt?: number;
  sentAt?: number;
  messageId?: string;            // WA message ID
  error?: string;
  
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}
```

### 3.9 EventLog (auditoría)
```ts
interface EventLog {
  id: string;                    // log_xxx
  type: EventLogType;
  level: 'info' | 'warning' | 'error';
  message: string;
  
  entityType?: string;
  entityId?: string;
  actorId?: string;
  actorType?: 'user' | 'system' | 'bot';
  
  data?: Record<string, any>;
  error?: string;
  
  timestamp: number;
  createdAt: number;
}

type EventLogType =
  | 'attendance_marked'
  | 'attendance_rule_triggered'
  | 'event_created'
  | 'event_updated'
  | 'event_cancelled'
  | 'event_reminder_triggered'
  | 'draft_created'
  | 'draft_approved'
  | 'draft_cancelled'
  | 'message_sent'
  | 'message_failed'
  | 'ticket_created'
  | 'ticket_resolved'
  | 'student_created'
  | 'student_updated'
  | 'class_created'
  | 'enrollment_created'
  | 'schedule_changed'
  | 'schedule_published'
  | 'system_error'
  | 'config_changed';
```

---

## 4. APIs del Backend (Express)

### 4.1 Estudiantes
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/admin/students` | Listar estudiantes |
| GET | `/api/admin/students/:id` | Obtener estudiante |
| POST | `/api/admin/students` | Crear estudiante |
| PUT | `/api/admin/students/:id` | Actualizar estudiante |
| DELETE | `/api/admin/students/:id` | Eliminar estudiante |
| GET | `/api/admin/students/:id/attendance` | Historial asistencia |
| GET | `/api/admin/students/:id/classes` | Clases inscritas |

### 4.2 Clases
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/admin/class-groups` | Listar clases |
| GET | `/api/admin/class-groups/:id` | Obtener clase |
| POST | `/api/admin/class-groups` | Crear clase |
| PUT | `/api/admin/class-groups/:id` | Actualizar clase |
| DELETE | `/api/admin/class-groups/:id` | Eliminar clase |
| GET | `/api/admin/class-groups/:id/students` | Roster de estudiantes |
| POST | `/api/admin/class-groups/:id/enroll` | Inscribir estudiante |
| DELETE | `/api/admin/class-groups/:id/enroll/:studentId` | Remover estudiante |

### 4.3 Asistencia
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/admin/attendance` | Listar registros |
| GET | `/api/admin/attendance/by-session/:sessionId` | Por sesión |
| GET | `/api/admin/attendance/by-student/:studentId` | Por estudiante |
| POST | `/api/admin/attendance/mark` | Marcar asistencia (batch) |
| GET | `/api/admin/attendance/daily-report` | Reporte diario |
| GET | `/api/admin/attendance/rules` | Listar reglas |
| POST | `/api/admin/attendance/rules/:id/run` | Ejecutar regla |

### 4.4 Eventos
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/admin/events` | Listar eventos |
| GET | `/api/admin/events/:id` | Obtener evento |
| POST | `/api/admin/events` | Crear evento |
| PUT | `/api/admin/events/:id` | Actualizar evento |
| DELETE | `/api/admin/events/:id` | Eliminar evento |
| GET | `/api/admin/events/:id/reminders` | Listar recordatorios |
| POST | `/api/admin/events/:id/reminders/trigger` | Disparar recordatorio ahora |
| GET | `/api/admin/events/upcoming` | Próximos eventos |

### 4.5 Borradores
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/admin/drafts` | Listar borradores |
| GET | `/api/admin/drafts/:id` | Obtener borrador |
| PUT | `/api/admin/drafts/:id` | Editar borrador |
| DELETE | `/api/admin/drafts/:id` | Eliminar borrador |
| POST | `/api/admin/drafts/:id/approve` | Aprobar borrador |
| POST | `/api/admin/drafts/:id/send` | Enviar borrador |
| POST | `/api/admin/drafts/send-batch` | Enviar múltiples |

### 4.6 Horarios
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/admin/schedule/weekly` | Vista semanal |
| GET | `/api/admin/schedule/by-teacher/:id` | Por profesor |
| GET | `/api/admin/schedule/by-room/:room` | Por salón |
| POST | `/api/admin/schedule/publish` | Publicar horario (genera borrador) |
| POST | `/api/admin/schedule/notify-change` | Notificar cambio |

### 4.7 Dashboard
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/admin/dashboard/summary` | Estadísticas agregadas |
| GET | `/api/admin/dashboard/recent-activity` | Actividad reciente |

---

## 5. Archivos de Persistencia Local

```
backend/data/
├── contacts.json
├── students.json
├── teachers.json
├── classGroups.json
├── enrollments.json
├── sessions.json
├── attendance.json
├── attendanceRules.json
├── events.json
├── eventReminders.json
├── templates.json
├── drafts.json
├── tickets.json
├── eventLog.json
└── config.json
```

---

## 6. Flujos de UI por Botón

### 6.1 Asistencias (Control diario)
**Ruta:** `/attendance`

**Tabs:**
1. **Hoy** - Marcar asistencia del día
2. **Reporte** - Estadísticas y filtros
3. **Automatizaciones** - Reglas de notificación

**Flujo "Hoy":**
1. Seleccionar fecha (default: hoy)
2. Seleccionar clase
3. Cargar lista de estudiantes inscritos
4. Marcar: ✅ Presente | ❌ Ausente | ⏰ Tarde
5. Nota opcional por estudiante
6. **Guardar** → crea AttendanceRecord
7. **Generar Borradores** → crea DraftMessage para ausentes

### 6.2 Alumnos
**Ruta:** `/students`

**Lista:**
- Búsqueda por nombre
- Filtro por programa, nivel, estado
- Acciones: Ver, Editar, Ver asistencia

**Crear/Editar:**
- Nombre, apellido
- Programa, instrumento, nivel
- Contactos (representantes)
- Estado

### 6.3 Clases
**Ruta:** `/classes`

**Lista:**
- Filtro por programa, profesor
- Mostrar: nombre, horario, inscritos, grupo WA

**Crear/Editar:**
- Nombre, programa, nivel
- Profesor asignado
- Horarios (múltiples)
- Salón, capacidad
- Grupo WhatsApp vinculado

**Inscripciones:**
- Agregar/remover estudiantes

### 6.4 Horarios
**Ruta:** `/schedule`

**Vistas:**
- Semana (grid por horas)
- Día (lista)
- Por profesor
- Por salón

**Acciones:**
- Ver detalle de clase
- Publicar horario → genera borrador

### 6.5 Nuevo Evento
**Ruta:** `/events/new`

**Formulario:**
1. **Información básica**
   - Título, tipo, fecha, hora
   - Ubicación, descripción
2. **Destinatarios**
   - Programas (multi-select)
   - Clases específicas
   - Grupos WhatsApp
   - Contactos individuales
3. **Recordatorios**
   - Activar/desactivar
   - Plantilla a usar
   - Momentos: 24h, 3h, 1h antes
   - Hora preferida de envío
   - Modo: borrador (default) / auto

**Al guardar:**
1. Crear Event
2. Crear EventReminder por cada momento
3. Registrar en EventLog

### 6.6 Respuestas Pendientes
**Ruta:** `/tickets`

**Lista:**
- Mensajes sin responder
- Prioridad (alta/normal)
- Sugerencia IA (si disponible)

**Acciones:**
- Responder → envía mensaje
- Guardar como FAQ
- Asignar a staff
- Marcar resuelto

---

## 7. Fases de Implementación

### Fase 1: CRUD Básico + Borradores (Semana 1-2)
- [ ] Students CRUD
- [ ] ClassGroups CRUD
- [ ] Enrollments CRUD
- [ ] Attendance marking UI
- [ ] DraftMessage CRUD + envío manual
- [ ] EventLog básico

### Fase 2: Eventos y Recordatorios (Semana 3-4)
- [ ] Events CRUD
- [ ] EventReminder configuración
- [ ] Generación de borradores por recordatorio
- [ ] Vista calendario
- [ ] Notificación de cambios de horario

### Fase 3: Reglas de Automatización (Semana 5-6)
- [ ] AttendanceRule engine
- [ ] Generación automática de borradores
- [ ] Batch approve/send
- [ ] Dashboard summary endpoint

### Fase 4: Tickets e IA (Semana 7+)
- [ ] Detección de tickets (mensajes sin responder)
- [ ] Integración sugerencias IA
- [ ] Guardar como FAQ
- [ ] Asignación a staff

### Fase 5: Auto-send Programado (Futuro)
- [ ] Background job scheduler
- [ ] Auto-send con ventana de confirmación
- [ ] Tracking de entrega
- [ ] Reintentos

---

## 8. Seguridad y Auditoría

### 8.1 Todas las acciones se registran
Cada acción significativa genera un EventLog:
- Quién (actorId)
- Qué (type, message)
- Cuándo (timestamp)
- Contexto (entityType, entityId, data)

### 8.2 Revisión de borradores obligatoria
- Ningún mensaje se envía sin acción explícita del staff
- Los borradores muestran exactamente qué se enviará
- Modal de confirmación antes de envíos masivos
- Mensajes enviados quedan registrados con messageId

### 8.3 Rate limiting
- Máximo 30 mensajes por minuto
- Delay entre envíos en batch
- Warning al acercarse a límites

---

## 9. Migración a Firestore (Futuro)

Cuando esté listo para migrar:
1. Mantener mismos modelos de datos
2. Reemplazar lecturas JSON por queries Firestore
3. Reemplazar escrituras JSON por transacciones Firestore
4. Agregar listeners real-time
5. Implementar autenticación de usuarios

La arquitectura actual está diseñada para esta migración:
- Patrón Repository (fácil cambiar implementación)
- IDs consistentes (UUID)
- Timestamps en todas las entidades
- Sin acceso directo a archivos desde rutas

---

*Fin de la Especificación Funcional*
