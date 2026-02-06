# API Routes Map

> Backend REST API endpoints for the WhatsApp Bot Admin Dashboard

## Base URL

```
http://localhost:3001/api
```

## Authentication

All admin endpoints require the `x-admin-api-key` header:

```
x-admin-api-key: {ADMIN_API_KEY}
```

---

## 1. Dashboard

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/admin/dashboard/summary` | Get aggregated dashboard stats | ✅ |
| GET | `/admin/dashboard/recent-activity` | Get recent event log entries | ✅ |
| POST | `/admin/dashboard/refresh` | Force refresh all data | ✅ |

### Response: Dashboard Summary

```json
{
  "success": true,
  "data": {
    "stats": {
      "totalStudents": 150,
      "activeStudents": 142,
      "totalClasses": 24,
      "totalTeachers": 12,
      "pendingDrafts": 5,
      "pendingTickets": 3,
      "todayAttendance": {
        "present": 120,
        "absent": 15,
        "late": 7
      }
    },
    "upcomingEvents": [...],
    "recentActivity": [...],
    "alerts": [...]
  }
}
```

---

## 2. Students

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/admin/students` | List all students | ✅ |
| GET | `/admin/students/:id` | Get student by ID | ✅ |
| POST | `/admin/students` | Create student | ✅ |
| PUT | `/admin/students/:id` | Update student | ✅ |
| DELETE | `/admin/students/:id` | Delete student | ✅ |
| GET | `/admin/students/:id/attendance` | Get student's attendance history | ✅ |
| GET | `/admin/students/:id/classes` | Get student's enrollments | ✅ |

### Query Parameters: List Students

| Param | Type | Description |
|-------|------|-------------|
| `search` | string | Search by name |
| `program` | string | Filter by program |
| `status` | string | Filter by status |
| `level` | string | Filter by level |

### Request: Create Student

```json
{
  "firstName": "Juan",
  "lastName": "Pérez",
  "program": "orquesta",
  "instrument": "violin",
  "level": "Nivel 1",
  "birthDate": "2015-03-15",
  "notes": "Alergia al polvo",
  "contacts": [
    {
      "firstName": "María",
      "lastName": "García",
      "phone": "+18095551234",
      "relationship": "Madre",
      "isPrimary": true
    }
  ]
}
```

---

## 3. Class Groups

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/admin/class-groups` | List all classes | ✅ |
| GET | `/admin/class-groups/:id` | Get class by ID | ✅ |
| POST | `/admin/class-groups` | Create class | ✅ |
| PUT | `/admin/class-groups/:id` | Update class | ✅ |
| DELETE | `/admin/class-groups/:id` | Delete class | ✅ |
| GET | `/admin/class-groups/:id/students` | Get enrolled students | ✅ |
| POST | `/admin/class-groups/:id/enroll` | Enroll student | ✅ |
| DELETE | `/admin/class-groups/:id/enroll/:studentId` | Remove student | ✅ |

### Query Parameters: List Classes

| Param | Type | Description |
|-------|------|-------------|
| `program` | string | Filter by program |
| `teacherId` | string | Filter by teacher |
| `day` | number | Filter by day of week (0-6) |

### Request: Create Class

```json
{
  "name": "Violín Nivel 1 - Miércoles",
  "program": "orquesta",
  "level": "Nivel 1",
  "teacherId": "teacher-uuid",
  "room": "Salón A",
  "capacity": 15,
  "schedules": [
    {
      "dayOfWeek": 3,
      "startTime": "16:00",
      "endTime": "17:30"
    }
  ],
  "waGroupJid": "123456789@g.us",
  "botEnabled": true
}
```

---

## 4. Enrollments

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/admin/enrollments` | List all enrollments | ✅ |
| POST | `/admin/enrollments` | Create enrollment | ✅ |
| PUT | `/admin/enrollments/:id` | Update enrollment | ✅ |
| DELETE | `/admin/enrollments/:id` | Delete enrollment | ✅ |

---

## 5. Sessions

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/admin/sessions` | List sessions | ✅ |
| GET | `/admin/sessions/today` | Get today's sessions | ✅ |
| POST | `/admin/sessions` | Create session | ✅ |
| PUT | `/admin/sessions/:id` | Update session | ✅ |

---

## 6. Attendance

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/admin/attendance` | List attendance records | ✅ |
| GET | `/admin/attendance/by-session/:sessionId` | Get by session | ✅ |
| GET | `/admin/attendance/by-student/:studentId` | Get by student | ✅ |
| POST | `/admin/attendance/mark` | Mark attendance (batch) | ✅ |
| GET | `/admin/attendance/daily-report` | Get daily stats | ✅ |
| GET | `/admin/attendance/absence-stats` | Get absence statistics | ✅ |

### Request: Mark Attendance

```json
{
  "sessionId": "session-uuid",
  "records": [
    {
      "studentId": "student-uuid-1",
      "status": "present"
    },
    {
      "studentId": "student-uuid-2",
      "status": "absent",
      "note": "Llamó para avisar"
    },
    {
      "studentId": "student-uuid-3",
      "status": "late"
    }
  ]
}
```

---

## 7. Attendance Rules

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/admin/attendance/rules` | List rules | ✅ |
| GET | `/admin/attendance/rules/:id` | Get rule | ✅ |
| POST | `/admin/attendance/rules` | Create rule | ✅ |
| PUT | `/admin/attendance/rules/:id` | Update rule | ✅ |
| DELETE | `/admin/attendance/rules/:id` | Delete rule | ✅ |
| POST | `/admin/attendance/rules/:id/run` | Execute rule (generate drafts) | ✅ |

### Request: Create Rule

```json
{
  "name": "Alerta 2+ ausencias",
  "condition": {
    "metric": "absences",
    "threshold": 2,
    "periodDays": 7
  },
  "action": {
    "type": "generate_draft",
    "templateId": "template-uuid",
    "targetType": "primary_contact"
  },
  "isActive": true
}
```

---

## 8. Events

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/admin/events` | List events | ✅ |
| GET | `/admin/events/:id` | Get event | ✅ |
| POST | `/admin/events` | Create event | ✅ |
| PUT | `/admin/events/:id` | Update event | ✅ |
| DELETE | `/admin/events/:id` | Delete event | ✅ |
| GET | `/admin/events/:id/reminders` | List reminders | ✅ |
| POST | `/admin/events/:id/reminders/trigger` | Trigger reminder now | ✅ |
| GET | `/admin/events/upcoming` | Get upcoming events | ✅ |
| GET | `/admin/events/calendar` | Get events for calendar view | ✅ |

### Query Parameters: List Events

| Param | Type | Description |
|-------|------|-------------|
| `type` | string | Filter by event type |
| `status` | string | Filter by status |
| `from` | string | Start date (YYYY-MM-DD) |
| `to` | string | End date (YYYY-MM-DD) |

### Request: Create Event

```json
{
  "title": "Concierto de Primavera",
  "type": "concert",
  "date": "2026-03-15",
  "startTime": "18:00",
  "endTime": "20:00",
  "location": "Auditorio Principal",
  "description": "Concierto anual de primavera",
  "targetPrograms": ["orquesta", "coro"],
  "targetClassGroupIds": [],
  "targetWaGroupJids": ["grupo-orquesta@g.us"],
  "enableReminders": true,
  "templateId": "template-uuid",
  "reminderOffsets": [-1440, -180, -60],
  "preferredSendTime": "08:00",
  "sendMode": "draft"
}
```

---

## 9. Drafts

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/admin/drafts` | List drafts | ✅ |
| GET | `/admin/drafts/:id` | Get draft | ✅ |
| PUT | `/admin/drafts/:id` | Update draft (edit message) | ✅ |
| DELETE | `/admin/drafts/:id` | Delete draft | ✅ |
| POST | `/admin/drafts/:id/approve` | Approve draft | ✅ |
| POST | `/admin/drafts/:id/send` | Send draft immediately | ✅ |
| POST | `/admin/drafts/send-batch` | Send multiple approved drafts | ✅ |
| POST | `/admin/drafts/generate` | Generate drafts manually | ✅ |

### Query Parameters: List Drafts

| Param | Type | Description |
|-------|------|-------------|
| `status` | string | Filter by status |
| `source` | string | Filter by source type |
| `from` | string | Start date |
| `to` | string | End date |

### Request: Send Batch

```json
{
  "draftIds": ["draft-1", "draft-2", "draft-3"],
  "delayMs": 2000
}
```

### Request: Generate Draft Manually

```json
{
  "targetType": "contact",
  "targetJid": "18095551234@s.whatsapp.net",
  "targetName": "María García",
  "message": "Mensaje personalizado",
  "templateId": "template-uuid",
  "variables": {
    "studentName": "Juan Pérez",
    "className": "Violín Nivel 1"
  },
  "source": "manual"
}
```

---

## 10. Tickets

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/admin/tickets` | List tickets | ✅ |
| GET | `/admin/tickets/:id` | Get ticket with chat context | ✅ |
| POST | `/admin/tickets/:id/respond` | Send response | ✅ |
| POST | `/admin/tickets/:id/save-faq` | Save to knowledge base | ✅ |
| POST | `/admin/tickets/:id/assign` | Assign to staff | ✅ |
| POST | `/admin/tickets/:id/resolve` | Mark as resolved | ✅ |
| POST | `/admin/tickets/:id/dismiss` | Dismiss ticket | ✅ |

### Query Parameters: List Tickets

| Param | Type | Description |
|-------|------|-------------|
| `status` | string | Filter by status |
| `priority` | string | Filter by priority |
| `hasAiSuggestion` | boolean | Filter by AI suggestion |

### Request: Respond to Ticket

```json
{
  "message": "La próxima clase es el miércoles a las 4pm.",
  "useAiSuggestion": false
}
```

### Request: Save as FAQ

```json
{
  "question": "¿Cuándo es la próxima clase?",
  "answer": "Las clases se realizan según el horario de cada grupo.",
  "category": "horarios"
}
```

---

## 11. Schedule

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/admin/schedule/weekly` | Get weekly schedule | ✅ |
| GET | `/admin/schedule/by-teacher/:id` | Schedule by teacher | ✅ |
| GET | `/admin/schedule/by-room/:room` | Schedule by room | ✅ |
| GET | `/admin/schedule/by-program/:program` | Schedule by program | ✅ |
| POST | `/admin/schedule/publish` | Generate publish draft | ✅ |
| POST | `/admin/schedule/notify-change` | Generate change notification | ✅ |

### Query Parameters: Weekly Schedule

| Param | Type | Description |
|-------|------|-------------|
| `weekStart` | string | Start of week (YYYY-MM-DD) |
| `teacherId` | string | Filter by teacher |
| `room` | string | Filter by room |
| `program` | string | Filter by program |

### Request: Notify Schedule Change

```json
{
  "classGroupId": "class-uuid",
  "changeType": "time_change",
  "oldSchedule": {
    "dayOfWeek": 3,
    "startTime": "16:00"
  },
  "newSchedule": {
    "dayOfWeek": 4,
    "startTime": "17:00"
  },
  "message": "La clase de violín se ha cambiado de miércoles a jueves."
}
```

---

## 12. Templates (Existing)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/admin/templates` | List templates | - |
| GET | `/admin/templates/:id` | Get template | - |
| POST | `/admin/templates` | Create template | ✅ |
| PUT | `/admin/templates/:id` | Update template | ✅ |
| DELETE | `/admin/templates/:id` | Delete template | ✅ |
| POST | `/admin/templates/:id/render` | Render with variables | ✅ |

---

## 13. Contacts (Existing)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/admin/contacts` | List contacts | - |
| GET | `/admin/contacts/:id` | Get contact | - |
| POST | `/admin/contacts` | Create contact | ✅ |
| PUT | `/admin/contacts/:id` | Update contact | ✅ |
| DELETE | `/admin/contacts/:id` | Delete contact | ✅ |

---

## 14. Teachers (Existing)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/admin/teachers` | List teachers | - |
| GET | `/admin/teachers/:id` | Get teacher | - |
| POST | `/admin/teachers` | Create teacher | ✅ |
| PUT | `/admin/teachers/:id` | Update teacher | ✅ |
| DELETE | `/admin/teachers/:id` | Delete teacher | ✅ |

---

## 15. Event Log

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/admin/event-log` | List event log entries | ✅ |
| GET | `/admin/event-log/by-entity/:type/:id` | Get logs for entity | ✅ |

### Query Parameters: Event Log

| Param | Type | Description |
|-------|------|-------------|
| `type` | string | Filter by log type |
| `level` | string | Filter by level |
| `from` | string | Start date |
| `to` | string | End date |
| `limit` | number | Max results (default 50) |

---

## Error Responses

### 400 Bad Request

```json
{
  "success": false,
  "error": "Validation error message"
}
```

### 401 Unauthorized

```json
{
  "success": false,
  "error": "Invalid API key"
}
```

### 404 Not Found

```json
{
  "success": false,
  "error": "Resource not found"
}
```

### 500 Internal Server Error

```json
{
  "success": false,
  "error": "Internal server error"
}
```

---

## Implementation Priority

### Phase 1 (Core)
- [x] Templates CRUD
- [x] Contacts CRUD
- [x] Teachers CRUD
- [ ] Students CRUD
- [ ] Class Groups CRUD
- [ ] Enrollments CRUD
- [ ] Drafts CRUD + Send

### Phase 2 (Attendance)
- [ ] Sessions CRUD
- [ ] Attendance marking
- [ ] Attendance rules
- [ ] Daily reports

### Phase 3 (Events)
- [ ] Events CRUD
- [ ] Event reminders
- [ ] Calendar view
- [ ] Schedule views

### Phase 4 (Tickets)
- [ ] Ticket detection
- [ ] AI suggestions
- [ ] Response workflow
- [ ] FAQ integration

### Phase 5 (Dashboard)
- [ ] Summary endpoint
- [ ] Recent activity
- [ ] Alerts aggregation
