# Metrics & Observability

> **Status:** SEED (Phase A)  
> **Purpose:** Passive data collection for future analytics  
> **No dashboards or automation included**

---

## Overview

The MetricsService provides lightweight, non-blocking event logging for observability purposes. It records system events to a JSONL file for future analysis without impacting bot performance.

---

## Event Types

| Event | Description | Recorded At |
|-------|-------------|-------------|
| `message_received` | Incoming WhatsApp message | BotService |
| `resolved_by_kb` | Message answered by Knowledge Base | BotOrchestrator |
| `resolved_by_ai` | Message answered by Gemini AI | BotOrchestrator |
| `escalated_to_human` | Alert created, human intervention needed | BotOrchestrator |
| `human_replied` | Human responded to an alert | PendingAlertService |
| `fallback_response` | Generic fallback used (no KB/AI match) | BotOrchestrator |
| `bot_toggled` | Bot enabled/disabled for a chat | BotService |
| `connection_status` | WhatsApp connection state change | BotService |
| `error` | Error occurred during processing | Various |

---

## Data Structure

Events are stored as JSONL (one JSON object per line) in:

```
data/metrics/events.jsonl
```

### Event Schema

```typescript
interface MetricEvent {
    timestamp: string;      // ISO 8601 format
    event: MetricEventType; // Event type from table above
    chatJid?: string;       // Anonymized JID (e.g., "549***@s.whatsapp.net")
    data?: {                // Event-specific data
        [key: string]: unknown;
    };
}
```

### Example Events

```json
{"timestamp":"2025-01-26T20:30:00.000Z","event":"message_received","chatJid":"549***@s.whatsapp.net","data":{"messageLength":45,"isGroup":false}}
{"timestamp":"2025-01-26T20:30:00.150Z","event":"resolved_by_kb","chatJid":"549***@s.whatsapp.net","data":{"confidence":0.85,"responseTimeMs":150}}
{"timestamp":"2025-01-26T20:31:00.000Z","event":"escalated_to_human","chatJid":"521***@s.whatsapp.net","data":{"alertId":"alert-123","priority":"medium","intent":"consulta_precio"}}
{"timestamp":"2025-01-26T20:35:00.000Z","event":"human_replied","chatJid":"521***@s.whatsapp.net","data":{"alertId":"alert-123","responseTimeMs":240000,"shouldLearn":true}}
```

---

## Integration Points

### 1. BotService (`src/server/services/botService.ts`)

| Point | Event | Data |
|-------|-------|------|
| Message handler | `message_received` | messageLength, isGroup |
| Connection ready | `connection_status` | status: 'connected' |
| Auth failure | `connection_status` | status: 'disconnected' |
| Processing error | `error` | context, message |

### 2. BotOrchestrator (`src/agents/BotOrchestrator.ts`)

| Point | Event | Data |
|-------|-------|------|
| KB match found | `resolved_by_kb` | confidence, responseTimeMs |
| Gemini response | `resolved_by_ai` | responseTimeMs, confidence |
| Alert created | `escalated_to_human` | alertId, priority, intent |
| No match, no escalation | `fallback_response` | reason |

### 3. PendingAlertService (`src/server/services/pendingAlertService.ts`)

| Point | Event | Data |
|-------|-------|------|
| Alert responded | `human_replied` | alertId, responseTimeMs, shouldLearn |

---

## Performance Considerations

- **Non-blocking:** Events are buffered in memory
- **Batched writes:** Flush to disk every 5 seconds or 100 events
- **File rotation:** Automatic rotation at 10MB
- **Privacy:** JIDs are anonymized (country code only preserved)
- **Minimal overhead:** ~1ms per event recording

---

## File Management

| File | Purpose |
|------|---------|
| `data/metrics/events.jsonl` | Current event log |
| `data/metrics/events-{timestamp}.jsonl` | Rotated logs |

Rotation occurs automatically when the file exceeds 10MB.

---

## Future Use (Phase C+)

This data can be used to build:

### Analytics (Phase C)
- Resolution rate by source (KB vs AI vs Human)
- Average response times
- Peak usage hours
- Common escalation intents

### Dashboards (Phase D)
- Real-time message volume
- KB effectiveness metrics
- Human workload indicators
- Trend analysis

### Automation (Phase E)
- Identify KB gaps from frequent escalations
- Auto-detect declining KB performance
- Capacity planning based on volume trends

---

## Querying Metrics (Manual)

Since no dashboard exists yet, you can query metrics manually:

### Count events by type (PowerShell)
```powershell
Get-Content data/metrics/events.jsonl | ForEach-Object { ($_ | ConvertFrom-Json).event } | Group-Object | Sort-Object Count -Descending
```

### Count events by type (Bash)
```bash
cat data/metrics/events.jsonl | jq -r '.event' | sort | uniq -c | sort -rn
```

### Filter by date range
```bash
cat data/metrics/events.jsonl | jq -r 'select(.timestamp >= "2025-01-26" and .timestamp < "2025-01-27")'
```

### Calculate average KB response time
```bash
cat data/metrics/events.jsonl | jq -r 'select(.event == "resolved_by_kb") | .data.responseTimeMs' | awk '{sum+=$1; count++} END {print sum/count "ms"}'
```

---

## Configuration

The MetricsService has no external configuration. Internal constants:

| Constant | Value | Description |
|----------|-------|-------------|
| `METRICS_DIR` | `data/metrics/` | Storage directory |
| `MAX_FILE_SIZE_MB` | 10 | Rotation threshold |
| Flush interval | 5000ms | Write frequency |
| Buffer limit | 100 events | Force flush threshold |

---

## Disabling Metrics

To disable metrics collection (not recommended):

```typescript
import MetricsService from './services/metricsService';
MetricsService.getInstance().disable();
```

---

## API Reference

```typescript
class MetricsService {
    // Core method
    record(event: MetricEventType, chatJid?: string, data?: Record<string, unknown>): void;

    // Convenience methods
    messageReceived(chatJid: string, messageLength: number, isGroup?: boolean): void;
    resolvedByKB(chatJid: string, confidence: number, responseTimeMs: number, category?: string): void;
    resolvedByAI(chatJid: string, responseTimeMs: number, confidence?: number): void;
    escalatedToHuman(chatJid: string, alertId: string, priority: string, intent?: string): void;
    humanReplied(chatJid: string, alertId: string, responseTimeMs: number, shouldLearn: boolean): void;
    fallbackResponse(chatJid: string, reason?: string): void;
    botToggled(chatJid: string, enabled: boolean): void;
    connectionStatus(status: 'connected' | 'disconnected' | 'connecting'): void;
    error(context: string, message: string, chatJid?: string): void;

    // Utility
    getBufferSize(): number;
    forceFlush(): void;
    disable(): void;
}
```

---

*Document version: 1.0 | Last updated: 2025-01-26*
