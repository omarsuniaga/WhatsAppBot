# Critical Path Tests

> **Priority:** DO NO HARM  
> **Framework:** Vitest  
> **Focus:** Prevent regressions in critical system paths

---

## Setup

```bash
npm install
npm test
```

---

## Test Files

| File | Critical Path | Tests |
|------|---------------|-------|
| `critical/anti-loop.test.ts` | Bot never responds to itself | 12 |
| `critical/escalation.test.ts` | Alert creation & rate limiting | 12 |
| `critical/bot-assignment.test.ts` | Per-chat bot configuration | 14 |

---

## Scenarios Covered ✅

### Anti-Loop Protection (`anti-loop.test.ts`)

| ID | Scenario | Severity |
|----|----------|----------|
| AL-01 | Skip messages where `isFromMe=true` | 🔴 CRITICAL |
| AL-02 | Detect echo of bot's own message | 🔴 CRITICAL |
| AL-03 | Allow different messages from same chat | 🟢 Normal |
| AL-04 | Allow same message after loop window expires | 🟢 Normal |
| AL-05 | Prevent concurrent processing of same chat | 🟠 Important |
| AL-06 | Allow parallel processing of different chats | 🟢 Normal |
| AL-07 | Reject empty messages | 🟠 Important |
| AL-08 | Reject invalid JID formats | 🟠 Important |
| AL-09 | Accept valid individual JIDs | 🟢 Normal |
| AL-10 | Accept valid group JIDs | 🟢 Normal |
| AL-11 | Truncate extremely long messages | 🟢 Normal |

### Escalation Logic (`escalation.test.ts`)

| ID | Scenario | Severity |
|----|----------|----------|
| ES-01 | Allow alert when all conditions met | 🟢 Normal |
| ES-02 | Block alert when `autoEscalate=false` | 🟠 Important |
| ES-03 | Block alert with invalid JID | 🟠 Important |
| ES-04 | Block alert with empty message | 🟠 Important |
| ES-05 | Rate limit: max 5 alerts/hour/chat | 🔴 CRITICAL |
| ES-06 | Rate limits are per-chat independent | 🟠 Important |
| ES-07 | HIGH priority for complaints | 🟢 Normal |
| ES-08 | HIGH priority for urgent issues | 🟢 Normal |
| ES-09 | MEDIUM priority for purchases | 🟢 Normal |
| ES-10 | LOW priority for general inquiries | 🟢 Normal |
| ES-11 | Update alert status on response | 🟢 Normal |
| ES-12 | Reject response to non-existent alert | 🟢 Normal |
| ES-13 | Reject empty response | 🟠 Important |

### Bot Assignment (`bot-assignment.test.ts`)

| ID | Scenario | Severity |
|----|----------|----------|
| BA-01 | Bot DISABLED by default | 🔴 CRITICAL |
| BA-02 | No response when no assignment exists | 🔴 CRITICAL |
| BA-03 | No response when assignment disabled | 🟠 Important |
| BA-04 | Global kill switch overrides all | 🔴 CRITICAL |
| BA-05 | Enable bot for specific chat | 🟢 Normal |
| BA-06 | Disable bot for specific chat | 🟢 Normal |
| BA-07 | Toggle doesn't affect other chats | 🟠 Important |
| BA-08 | Create assignment with custom config | 🟢 Normal |
| BA-09 | Update existing assignment | 🟢 Normal |
| BA-10 | No duplicate assignments | 🟢 Normal |
| BA-11 | Respond when all conditions met | 🟢 Normal |
| BA-12 | NEVER respond to own messages | 🔴 CRITICAL |
| BA-13 | Track group status correctly | 🟢 Normal |

---

## Scenarios NOT Covered ⚠️

These scenarios require integration tests or are deferred:

| Scenario | Reason | Risk |
|----------|--------|------|
| WhatsApp connection handling | Requires Baileys mock | Low |
| Actual message sending | Requires WhatsApp API | Medium |
| Gemini AI responses | Requires API mock | Low |
| Knowledge Base search accuracy | Covered by QASearchAgent | Low |
| Socket.IO event emission | Integration test needed | Low |
| File persistence (JSON) | Integration test needed | Low |
| Learning service integration | Not in critical path | Low |
| Metrics recording | Not in critical path | Low |

---

## Running Tests

```bash
# Run all tests
npm test

# Run with watch mode
npm run test:watch

# Run specific test file
npx vitest run tests/critical/anti-loop.test.ts

# Run with coverage
npx vitest run --coverage
```

---

## Test Design Philosophy

1. **Extract & Test** - Logic is extracted into testable validators
2. **No External Dependencies** - Tests don't require WhatsApp, AI, or files
3. **Critical First** - Focus on "do no harm" over coverage percentage
4. **Fast Execution** - All tests run in < 1 second

---

## Adding New Tests

When adding tests, prioritize:

1. 🔴 **CRITICAL** - System stability, anti-loop, rate limiting
2. 🟠 **IMPORTANT** - Input validation, error handling
3. 🟢 **NORMAL** - Feature correctness, edge cases

---

*Test suite version: 1.0 | Last updated: 2025-01-26*
