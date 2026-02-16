# Daily WhatsApp Class Reminders - Implementation Guide

## Overview
Automated daily class reminder system that sends WhatsApp messages with the day's class schedule to configured groups.

## Implementation Plan Reference

### ✅ Completed Components

#### 1. **DailyReminderService** 
   - **File:** [src/server/services/dailyReminderService.ts](src/server/services/dailyReminderService.ts)
   - **Features:**
     - Fetches classes for the current day of week
     - Generates AI-formatted message using Gemini API
     - Sends messages to configured WhatsApp groups
     - Includes dry-run capability for testing
     - Automatically starts scheduler at 12:01 PM daily (cron: `1 12 * * *`)
   
   - **Key Methods:**
     ```typescript
     - executeDailyReminder(force?: boolean)  // Main execution
     - generateDryRun()                        // Test without sending
     - startScheduler()                        // Initialize daily cron job
     - getStatus()                             // Check service status
     ```

#### 2. **DailyReminderController**
   - **File:** `src/server/controllers/dailyReminderController.ts` (NEW)
   - **Endpoints:**
     - `GET /api/daily-reminders/status` - Get service status and configuration
     - `POST /api/daily-reminders/test` - Generate message without sending (dry-run)
     - `POST /api/daily-reminders/execute` - Manually trigger reminder

#### 3. **Route Integration**
   - **File:** [src/server/routes/index.ts](src/server/routes/index.ts) (UPDATED)
   - Routes registered and properly exported
   - Added import for `dailyReminderController`

#### 4. **Server Initialization**
   - **File:** [src/server/index.ts](src/server/index.ts) (UPDATED)
   - Service instantiated on server startup
   - Scheduler automatically initialized
   - Graceful error handling if cron unavailable

---

## Configuration

### Default Settings
```typescript
const DEFAULT_CONFIG = {
    enabled: true,
    scheduleTime: '12:01',     // 24-hour format (UTC)
    targetGroups: [
        'PROGRAMA ORQUESTAL - El Sistema Punta Cana',
        'PROGRAMA ORQUESTAL',
        'PROGRAMA CORAL'
    ]
};
```

### Required Environment Variables
- `GEMINI_API_KEY` - API key for message generation (from BotOrchestrator or env)

### Dependencies
- `node-cron` - Cron job scheduling
- `@google/generative-ai` - Gemini API for message generation
- Firestore collections: `CLASES`, `MAESTROS`
- BotService - WhatsApp group management and message sending

---

## Data Flow

```
Daily Reminder Flow (Automatic at 12:01 PM):
┌─────────────────────────────────────────┐
│ Cron Job Triggered                      │
│ (node-cron: "1 12 * * *")              │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ DailyReminderService.executeDailyReminder()
└──────────────┬──────────────────────────┘
               │
        ┌──────┴──────┐
        │             │
        ▼             ▼
    [1] Fetch     [2] Prepare
    Classes      Schedule
    for Today    Context
        │             │
        └──────┬──────┘
               ▼
        ┌─────────────────────┐
        │ [3] Generate Message
        │ with Gemini AI      │
        └────────────┬────────┘
                     ▼
        ┌─────────────────────────┐
        │ [4] Send to Target Groups
        │ via BotService.sendText │
        └─────────────────────────┘
               │        │        │
               ▼        ▼        ▼
        "PROGRAMA   "PROGRAMA  Other
        ORQUESTAL"   CORAL"    Groups
```

---

## Testing

### 1. **Test Dry-Run (Generate without sending)**
```bash
curl -X POST http://localhost:3001/api/daily-reminders/test
```
Response:
```json
{
  "success": true,
  "message": "Daily reminder generated successfully",
  "data": {
    "timestamp": "2026-02-09T15:30:00Z",
    "classesFound": 5,
    "generatedMessage": "🎶 RECORDATORIO...",
    "targetGroups": ["PROGRAMA ORQUESTAL - El Sistema Punta Cana"]
  }
}
```

### 2. **Check Service Status**
```bash
curl http://localhost:3001/api/daily-reminders/status
```
Response:
```json
{
  "success": true,
  "data": {
    "enabled": true,
    "scheduleTime": "12:01",
    "targetGroups": ["PROGRAMA ORQUESTAL - El Sistema Punta Cana", ...],
    "availableGroups": 2
  }
}
```

### 3. **Manually Execute Reminder**
```bash
curl -X POST http://localhost:3001/api/daily-reminders/execute
```
Response:
```json
{
  "success": true,
  "message": "Sent to 2 groups. Failed: 0",
  "timestamp": "2026-02-09T15:32:15Z"
}
```

---

## Verification Checklist

- [x] Service class created with singleton pattern
- [x] Methods for fetch, generate, send implemented
- [x] Dry-run capability added (`generateDryRun()`)
- [x] Status method added (`getStatus()`)
- [x] Controller created with proper error handling
- [x] Routes registered in main router
- [x] Service initialized in `server/index.ts`
- [x] Scheduler started automatically on server startup
- [x] Cron pattern configured correctly (12:01 PM)
- [x] Target groups configurable
- [x] Fallback to mock response if API key missing
- [x] No TypeScript compilation errors in implementation

---

## Known Issues & Notes

### Frontend Build Errors (Pre-existing, not caused by this feature)
- `ClassesPage.tsx:186` - Type mismatch on `profesor_ids`
- `SchedulePage.tsx:64` - Type incompatibility on `teacherIds`
- `AttendancePage.tsx:30` - Unused import `AttendanceCalendar`

These are not related to the Daily Reminder feature and should be handled separately.

---

## Future Enhancements

1. **Configuration UI** - Allow admins to modify schedule time and target groups from dashboard
2. **Message Templates** - Pre-defined message formats for different group types
3. **Failure Notifications** - Alert admins if message sending fails
4. **Analytics** - Track when reminders are sent and delivery status
5. **Multi-language Support** - Spanish/English message variations
6. **Rate Limiting** - Ensure message queue respects WhatsApp limits

---

## Architecture Decisions

### Why Singleton Pattern?
- Ensures only one instance of the scheduler
- Prevents duplicate cron jobs
- Simplifies access from controllers

### Why Dry-Run Capability?
- Allows verification before automatic execution
- Enables testing without side effects
- Helps debug message generation

### Why Center Configuration?
- Easy to modify schedule and targets
- Prevents hardcoding group names
- Allows future admin UI integration

---

## Support & Debugging

### Check if scheduler is running:
```bash
# Look for logs in server output:
# "[Server] Daily Reminder scheduler initialized"
# "[DailyReminder] Triggering scheduled daily reminder..."
```

### If messages not sending:
1. Verify target group names match WhatsApp groups exactly
2. Check Gemini API key is configured
3. Ensure bot has permission to send to groups
4. Check that classes exist for the current day

### If cron not running:
- Ensure `node-cron` is installed: `npm list node-cron`
- Check server logs for cron initialization errors
- Manual execution endpoint still works via POST `/api/daily-reminders/execute`

---

*Documentation generated for Daily WhatsApp Class Reminders feature*
*Compatibility: Any Node.js + Firestore setup with WhatsApp Bot (Baileys)*
