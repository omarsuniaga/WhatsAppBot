# Admin API Documentation

REST API endpoints for the admin dashboard to manage institutional data.

**Base URL:** `http://localhost:3001/api/admin`

## Authentication

Write operations require the `X-Admin-Key` header with the value matching `ADMIN_API_KEY` environment variable.

```bash
# Set your admin key
export ADMIN_API_KEY="your-secret-key"

# Include in requests
-H "X-Admin-Key: $ADMIN_API_KEY"
```

---

## Contacts

### List Contacts
```bash
curl http://localhost:3001/api/admin/contacts

# With filters
curl "http://localhost:3001/api/admin/contacts?status=active&type=guardian"

# Search
curl "http://localhost:3001/api/admin/contacts?search=maria"
```

### Get Contact by ID
```bash
curl http://localhost:3001/api/admin/contacts/ct_abc123
```

### Create Contact
```bash
curl -X POST http://localhost:3001/api/admin/contacts \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: $ADMIN_API_KEY" \
  -d '{
    "firstName": "Maria",
    "lastName": "Garcia",
    "phone": "+18095551234",
    "email": "maria@example.com",
    "type": "guardian"
  }'
```

### Update Contact
```bash
curl -X PUT http://localhost:3001/api/admin/contacts/ct_abc123 \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: $ADMIN_API_KEY" \
  -d '{
    "email": "maria.garcia@example.com"
  }'
```

### Delete Contact
```bash
curl -X DELETE http://localhost:3001/api/admin/contacts/ct_abc123 \
  -H "X-Admin-Key: $ADMIN_API_KEY"
```

---

## Students

### List Students
```bash
curl http://localhost:3001/api/admin/students

# With filters
curl "http://localhost:3001/api/admin/students?status=active&instrument=violin"

# Search
curl "http://localhost:3001/api/admin/students?search=carlos"
```

### Get Student by ID
```bash
curl http://localhost:3001/api/admin/students/st_abc123
```

### Create Student
```bash
curl -X POST http://localhost:3001/api/admin/students \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: $ADMIN_API_KEY" \
  -d '{
    "firstName": "Carlos",
    "lastName": "Martinez",
    "dateOfBirth": "2015-03-15",
    "primaryContactId": "ct_abc123",
    "instruments": ["violin"]
  }'
```

### Update Student
```bash
curl -X PUT http://localhost:3001/api/admin/students/st_abc123 \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: $ADMIN_API_KEY" \
  -d '{
    "instruments": ["violin", "piano"]
  }'
```

### Delete Student
```bash
curl -X DELETE http://localhost:3001/api/admin/students/st_abc123 \
  -H "X-Admin-Key: $ADMIN_API_KEY"
```

---

## Teachers

### List Teachers
```bash
curl http://localhost:3001/api/admin/teachers

# With filters
curl "http://localhost:3001/api/admin/teachers?status=active&instrument=piano"
```

### Get Teacher by ID
```bash
curl http://localhost:3001/api/admin/teachers/tc_abc123
```

### Create Teacher
```bash
curl -X POST http://localhost:3001/api/admin/teachers \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: $ADMIN_API_KEY" \
  -d '{
    "firstName": "Juan",
    "lastName": "Rodriguez",
    "contactId": "ct_def456",
    "instruments": ["piano", "guitar"],
    "title": "Professor"
  }'
```

### Update Teacher
```bash
curl -X PUT http://localhost:3001/api/admin/teachers/tc_abc123 \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: $ADMIN_API_KEY" \
  -d '{
    "title": "Senior Professor"
  }'
```

### Delete Teacher
```bash
curl -X DELETE http://localhost:3001/api/admin/teachers/tc_abc123 \
  -H "X-Admin-Key: $ADMIN_API_KEY"
```

---

## Class Groups

### List Class Groups
```bash
curl http://localhost:3001/api/admin/class-groups

# With filters
curl "http://localhost:3001/api/admin/class-groups?status=active&programId=pg_123"
```

### Get Class Group by ID
```bash
curl http://localhost:3001/api/admin/class-groups/cl_abc123
```

### Create Class Group
```bash
curl -X POST http://localhost:3001/api/admin/class-groups \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: $ADMIN_API_KEY" \
  -d '{
    "name": "Violin Beginners A",
    "code": "VIO-BEG-A",
    "programId": "pg_123",
    "levelId": "lv_456",
    "teacherIds": ["tc_789"],
    "schedule": [
      {"dayOfWeek": "monday", "startTime": "09:00", "endTime": "10:30"}
    ],
    "maxStudents": 15
  }'
```

### Update Class Group
```bash
curl -X PUT http://localhost:3001/api/admin/class-groups/cl_abc123 \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: $ADMIN_API_KEY" \
  -d '{
    "maxStudents": 20
  }'
```

### Delete Class Group
```bash
curl -X DELETE http://localhost:3001/api/admin/class-groups/cl_abc123 \
  -H "X-Admin-Key: $ADMIN_API_KEY"
```

---

## Enrollments

### List Enrollments
```bash
curl http://localhost:3001/api/admin/enrollments

# With filters
curl "http://localhost:3001/api/admin/enrollments?studentId=st_123&status=active"
```

### Get Enrollment by ID
```bash
curl http://localhost:3001/api/admin/enrollments/en_abc123
```

### Create Enrollment
```bash
curl -X POST http://localhost:3001/api/admin/enrollments \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: $ADMIN_API_KEY" \
  -d '{
    "studentId": "st_abc123",
    "classGroupId": "cl_def456"
  }'
```

### Remove Enrollment (Withdraw)
```bash
curl -X DELETE http://localhost:3001/api/admin/enrollments/en_abc123 \
  -H "X-Admin-Key: $ADMIN_API_KEY"
```

---

## Sessions

### List Sessions
```bash
curl http://localhost:3001/api/admin/sessions

# By date
curl "http://localhost:3001/api/admin/sessions?date=2024-01-15"

# By date range
curl "http://localhost:3001/api/admin/sessions?startDate=2024-01-01&endDate=2024-01-31"
```

### Get Session by ID
```bash
curl http://localhost:3001/api/admin/sessions/ss_abc123
```

### Get Sessions by Date (with student counts)
```bash
curl "http://localhost:3001/api/admin/sessions/by-date?date=2024-01-15"
```

### Generate Sessions for Date
```bash
curl -X POST "http://localhost:3001/api/admin/sessions/generate?date=2024-01-15" \
  -H "X-Admin-Key: $ADMIN_API_KEY"
```

---

## Attendance

### List Attendance Records
```bash
curl http://localhost:3001/api/admin/attendance

# With filters
curl "http://localhost:3001/api/admin/attendance?sessionId=ss_123&status=absent"
```

### Mark Attendance
```bash
curl -X POST http://localhost:3001/api/admin/attendance/mark \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: $ADMIN_API_KEY" \
  -d '{
    "sessionId": "ss_abc123",
    "studentId": "st_def456",
    "status": "present"
  }'

# Mark late with arrival time
curl -X POST http://localhost:3001/api/admin/attendance/mark \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: $ADMIN_API_KEY" \
  -d '{
    "sessionId": "ss_abc123",
    "studentId": "st_def456",
    "status": "late",
    "arrivalTime": "09:15",
    "notes": "Traffic delay"
  }'
```

### Get Daily Report
```bash
curl "http://localhost:3001/api/admin/attendance/daily-report?date=2024-01-15"
```

### Get Absence Statistics
```bash
# Last 7 days (default)
curl http://localhost:3001/api/admin/attendance/absence-stats

# Custom period
curl "http://localhost:3001/api/admin/attendance/absence-stats?days=30"
```

---

## Templates

### List Templates
```bash
curl http://localhost:3001/api/admin/templates

# With filters
curl "http://localhost:3001/api/admin/templates?category=absence_notification&status=active"
```

### Get Template by ID
```bash
curl http://localhost:3001/api/admin/templates/tpl_abc123
```

### Create Template
```bash
curl -X POST http://localhost:3001/api/admin/templates \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: $ADMIN_API_KEY" \
  -d '{
    "name": "Absence Notification",
    "code": "ABSENCE_NOTIFY",
    "category": "absence_notification",
    "body": "Estimado/a {{guardianName}}, le informamos que {{studentName}} no asistió a la clase de {{className}} el día {{date}}.",
    "tags": ["attendance", "notification"]
  }'
```

### Update Template
```bash
curl -X PUT http://localhost:3001/api/admin/templates/tpl_abc123 \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: $ADMIN_API_KEY" \
  -d '{
    "body": "Updated template body with {{variable}}"
  }'
```

### Delete Template
```bash
curl -X DELETE http://localhost:3001/api/admin/templates/tpl_abc123 \
  -H "X-Admin-Key: $ADMIN_API_KEY"
```

### Render Template
```bash
curl -X POST http://localhost:3001/api/admin/templates/tpl_abc123/render \
  -H "Content-Type: application/json" \
  -d '{
    "variables": {
      "guardianName": "Maria Garcia",
      "studentName": "Carlos",
      "className": "Violin Beginners",
      "date": "15 de enero"
    }
  }'
```

---

## WhatsApp Groups

### List WhatsApp Groups
```bash
curl http://localhost:3001/api/admin/wa-groups

# With filters
curl "http://localhost:3001/api/admin/wa-groups?type=class_group&botEnabled=true"
```

### Get WhatsApp Group by ID
```bash
curl http://localhost:3001/api/admin/wa-groups/wa_abc123
```

### Create WhatsApp Group Entry
```bash
curl -X POST http://localhost:3001/api/admin/wa-groups \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: $ADMIN_API_KEY" \
  -d '{
    "jid": "123456789@g.us",
    "name": "Violin Beginners - Parents",
    "type": "class_group",
    "classGroupId": "cl_abc123",
    "botEnabled": true
  }'
```

### Update WhatsApp Group
```bash
curl -X PUT http://localhost:3001/api/admin/wa-groups/wa_abc123 \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: $ADMIN_API_KEY" \
  -d '{
    "botEnabled": false
  }'
```

### Toggle Bot for Group
```bash
curl -X POST http://localhost:3001/api/admin/wa-groups/wa_abc123/toggle-bot \
  -H "X-Admin-Key: $ADMIN_API_KEY"
```

### Delete WhatsApp Group Entry
```bash
curl -X DELETE http://localhost:3001/api/admin/wa-groups/wa_abc123 \
  -H "X-Admin-Key: $ADMIN_API_KEY"
```

---

## Knowledge Base

### Get KB Index
```bash
curl http://localhost:3001/api/admin/kb/index

# With filters
curl "http://localhost:3001/api/admin/kb/index?type=faq&status=active"

# Search
curl "http://localhost:3001/api/admin/kb/index?search=horarios"
```

### Get KB Entry by ID
```bash
curl http://localhost:3001/api/admin/kb/index/kb_abc123
```

### Create KB Entry
```bash
curl -X POST http://localhost:3001/api/admin/kb/index \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: $ADMIN_API_KEY" \
  -d '{
    "name": "FAQ - Horarios",
    "filename": "faq-horarios.md",
    "content": "# Horarios\n\nLas clases son de lunes a viernes...",
    "type": "faq",
    "keywords": ["horarios", "clases", "schedule"]
  }'
```

### Update KB Entry
```bash
curl -X PUT http://localhost:3001/api/admin/kb/index/kb_abc123 \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: $ADMIN_API_KEY" \
  -d '{
    "keywords": ["horarios", "clases", "schedule", "horas"]
  }'
```

### Delete KB Entry
```bash
curl -X DELETE http://localhost:3001/api/admin/kb/index/kb_abc123 \
  -H "X-Admin-Key: $ADMIN_API_KEY"
```

### Read KB File (Markdown)
```bash
curl "http://localhost:3001/api/admin/kb/file?path=faq.md"
```

### Write KB File (Markdown)
```bash
curl -X PUT "http://localhost:3001/api/admin/kb/file?path=faq.md" \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: $ADMIN_API_KEY" \
  -d '{
    "content": "# FAQ\n\n## Pregunta 1\nRespuesta 1..."
  }'
```

---

## Automations

### Generate Absence Notification Drafts
```bash
curl -X POST http://localhost:3001/api/admin/automations/absences/drafts \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: $ADMIN_API_KEY" \
  -d '{
    "days": 7,
    "threshold": 2,
    "templateId": "tpl_absence_warning"
  }'
```

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| days | number | Yes | Look back N days for absences |
| threshold | number | Yes | Minimum absences to trigger notification |
| templateId | string | No | Template ID for message (uses default if not provided) |
| dateRange | object | No | Specific date range `{ startDate, endDate }` in YYYY-MM-DD |
| dryRun | boolean | No | If true, don't log to EventLog |

**Response:**
```json
{
  "success": true,
  "data": {
    "drafts": [
      {
        "contactId": "ct_abc123",
        "contactName": "Maria Garcia",
        "phone": "+18095551234",
        "studentId": "st_def456",
        "studentName": "Carlos Garcia",
        "absenceCount": 3,
        "absenceDates": ["2024-01-10", "2024-01-12", "2024-01-15"],
        "messageText": "Estimado/a Maria Garcia, le informamos que Carlos Garcia ha tenido 3 ausencia(s)...",
        "reason": "3 absences in last 7 days (threshold: 3)",
        "templateId": "tpl_absence_warning"
      }
    ],
    "summary": {
      "studentsAnalyzed": 45,
      "studentsAboveThreshold": 3,
      "draftsGenerated": 3,
      "period": { "startDate": "2024-01-08", "endDate": "2024-01-15", "days": 7 },
      "threshold": 2
    },
    "errors": []
  }
}
```

### Preview Absence Draft for Student
```bash
curl -X POST http://localhost:3001/api/admin/automations/absences/preview \
  -H "Content-Type: application/json" \
  -d '{
    "studentId": "st_abc123",
    "days": 7,
    "templateId": "tpl_absence_warning"
  }'
```

---

## WhatsApp Sending

> **⚠️ Safety First**: All send endpoints require `ADMIN_API_KEY`. 
> Never automate sending without human confirmation. 
> The most expensive error is sending wrong message to wrong guardian.

### Send Single Message
```bash
curl -X POST http://localhost:3001/api/admin/whatsapp/send \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: $ADMIN_API_KEY" \
  -d '{
    "to": "+18095551234",
    "text": "Hello from El Sistema!",
    "context": {
      "templateId": "tpl_abc123",
      "studentId": "st_def456"
    }
  }'
```

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| to | string | Yes | Phone number (E164) or WhatsApp JID |
| text | string | Yes | Message text (max 4096 chars) |
| context | object | No | Metadata for logging (templateId, studentId, etc.) |

**Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "to": "+18095551234",
    "jid": "18095551234@s.whatsapp.net",
    "messageId": "3EB0ABC123...",
    "timestamp": 1706345678
  }
}
```

### Send Batch Messages
```bash
curl -X POST http://localhost:3001/api/admin/whatsapp/send-batch \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: $ADMIN_API_KEY" \
  -d '{
    "messages": [
      { "to": "+18095551234", "text": "Message 1" },
      { "to": "+18095555678", "text": "Message 2" }
    ]
  }'
```

**Limits:**
- Maximum 50 messages per batch
- 1 second delay between messages (rate limiting)

### Send Confirmed Drafts
```bash
curl -X POST http://localhost:3001/api/admin/whatsapp/send-drafts \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: $ADMIN_API_KEY" \
  -d '{
    "drafts": [
      {
        "phone": "+18095551234",
        "messageText": "Estimado/a Maria...",
        "studentId": "st_abc123",
        "templateId": "tpl_absence"
      }
    ],
    "confirmedBy": "admin@example.com"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "confirmedBy": "admin@example.com",
    "total": 3,
    "successCount": 3,
    "failCount": 0,
    "results": [...]
  }
}
```

---

## Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request - Missing or invalid parameters |
| 401 | Unauthorized - Missing or invalid API key |
| 404 | Not Found |
| 409 | Conflict - Resource already exists |
| 500 | Server Error |

## Response Format

All responses follow this format:

```json
{
  "success": true,
  "data": { ... },
  "count": 10,
  "message": "Optional message"
}
```

Error responses:

```json
{
  "success": false,
  "error": "Error description"
}
```
