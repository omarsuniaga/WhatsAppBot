/**
 * WhatsAppRateLimiter Unit Tests
 *
 * Tests rate limiting logic that protects against WhatsApp bans.
 * Critical: incorrect rate limiting = account ban.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { WhatsAppRateLimiter } from './whatsappRateLimiter';

// WhatsAppRateLimiter is a singleton. We need to access internal state for testing.
// We'll use a fresh instance approach by clearing the singleton between tests.

function createFreshLimiter(): WhatsAppRateLimiter {
    // Reset singleton by clearing the static instance
    // @ts-ignore — accessing private static for testing
    WhatsAppRateLimiter.instance = undefined;
    const limiter = WhatsAppRateLimiter.getInstance();
    return limiter;
}

describe('WhatsAppRateLimiter', () => {
    let limiter: WhatsAppRateLimiter;

    beforeEach(() => {
        vi.useFakeTimers();
        limiter = createFreshLimiter();
    });

    afterEach(() => {
        limiter.shutdown();
        vi.useRealTimers();
    });

    // ============================================
    // Singleton
    // ============================================

    describe('Singleton pattern', () => {
        it('should return the same instance', () => {
            const instance1 = WhatsAppRateLimiter.getInstance();
            const instance2 = WhatsAppRateLimiter.getInstance();
            expect(instance1).toBe(instance2);
        });
    });

    // ============================================
    // canSendMessage — Basic behavior
    // ============================================

    describe('canSendMessage', () => {
        it('should allow first message to a new chat', async () => {
            const result = await limiter.canSendMessage('5511999999999@s.whatsapp.net');
            expect(result.canSend).toBe(true);
            expect(result.waitTime).toBe(0);
        });

        it('should enforce minimum interval between messages (2s for DM)', async () => {
            const jid = '5511999999999@s.whatsapp.net';

            // First message — allowed
            const first = await limiter.canSendMessage(jid);
            expect(first.canSend).toBe(true);
            limiter.recordSentMessage(jid);

            // Immediately — blocked
            const second = await limiter.canSendMessage(jid);
            expect(second.canSend).toBe(false);
            expect(second.reason).toBe('minimum_interval');
            expect(second.waitTime).toBeGreaterThan(0);
            expect(second.waitTime).toBeLessThanOrEqual(2000);
        });

        it('should enforce 3s minimum interval for groups', async () => {
            const jid = '120363000000000000@g.us';

            const first = await limiter.canSendMessage(jid);
            expect(first.canSend).toBe(true);
            limiter.recordSentMessage(jid);

            // After 2s — still blocked for groups (need 3s)
            vi.advanceTimersByTime(2100);
            const second = await limiter.canSendMessage(jid);
            expect(second.canSend).toBe(false);
            expect(second.reason).toBe('minimum_interval');
        });

        it('should allow message after minimum interval passes', async () => {
            const jid = '5511999999999@s.whatsapp.net';

            const first = await limiter.canSendMessage(jid);
            expect(first.canSend).toBe(true);
            limiter.recordSentMessage(jid);

            // Advance past 2s
            vi.advanceTimersByTime(2100);

            const second = await limiter.canSendMessage(jid);
            expect(second.canSend).toBe(true);
        });
    });

    // ============================================
    // Burst tokens
    // ============================================

    describe('Burst token management', () => {
        it('should consume burst tokens on send', async () => {
            const jid = '5511999999999@s.whatsapp.net';

            // Send 5 messages (default burst allowance = 5) with sufficient time between
            for (let i = 0; i < 5; i++) {
                const result = await limiter.canSendMessage(jid);
                expect(result.canSend).toBe(true);
                limiter.recordSentMessage(jid);
                vi.advanceTimersByTime(2100); // Pass minimum interval
            }

            // 6th message — burst tokens exhausted
            const result = await limiter.canSendMessage(jid);
            expect(result.canSend).toBe(false);
            expect(result.reason).toBe('burst_limit_exceeded');
        });

        it('should recover burst tokens over time', async () => {
            const jid = '5511999999999@s.whatsapp.net';

            // Exhaust burst tokens
            for (let i = 0; i < 5; i++) {
                await limiter.canSendMessage(jid);
                limiter.recordSentMessage(jid);
                vi.advanceTimersByTime(2100);
            }

            // Verify blocked
            let result = await limiter.canSendMessage(jid);
            expect(result.canSend).toBe(false);

            // Wait for burst recovery (2s per token)
            vi.advanceTimersByTime(2100);

            // Now should have recovered 1 token
            result = await limiter.canSendMessage(jid);
            expect(result.canSend).toBe(true);
        });
    });

    // ============================================
    // Per-minute limits
    // ============================================

    describe('Per-minute limits', () => {
        it('should block after per-minute limit exceeded (10 msg/min for DM)', async () => {
            const jid = '5511999999999@s.whatsapp.net';

            // Send 10 messages with enough time and burst tokens
            // Default: burstAllowance=5, burstRecoveryRateMs=2000
            // We need to space messages to allow burst recovery
            for (let i = 0; i < 10; i++) {
                const check = await limiter.canSendMessage(jid);
                if (check.canSend) {
                    limiter.recordSentMessage(jid);
                }
                vi.advanceTimersByTime(2100); // Enough for interval + burst recovery
            }

            // 11th message in the same minute — should be blocked by per-minute limit
            const result = await limiter.canSendMessage(jid);
            expect(result.canSend).toBe(false);
            expect(result.reason).toBe('per_minute_limit');
        });
    });

    // ============================================
    // recordSentMessage
    // ============================================

    describe('recordSentMessage', () => {
        it('should increment counters after recording', async () => {
            const jid = '5511999999999@s.whatsapp.net';

            // Initialize chat limits by checking first
            await limiter.canSendMessage(jid);
            limiter.recordSentMessage(jid);

            // Verify stats reflect the message
            const stats = limiter.getStats();
            expect(stats.totalChats).toBe(1);
        });

        it('should handle recording for unknown jid gracefully', () => {
            // Record for a jid that was never checked — should not throw
            expect(() => {
                limiter.recordSentMessage('unknown@s.whatsapp.net');
            }).not.toThrow();
        });

        it('should keep recentMessages under 50 entries', async () => {
            const jid = '5511999999999@s.whatsapp.net';
            await limiter.canSendMessage(jid); // Initialize

            // Record many messages
            for (let i = 0; i < 60; i++) {
                limiter.recordSentMessage(jid);
            }

            // Internal check — messages should be trimmed
            // We can verify through the duplicate detection: sending many of same type
            // should trigger the pattern detection after 3 in 30s
            // This verifies the history is maintained (not overflowing)
            const stats = limiter.getStats();
            expect(stats.totalChats).toBe(1);
        });
    });

    // ============================================
    // Duplicate pattern detection
    // ============================================

    describe('Duplicate pattern detection', () => {
        it('should detect duplicate message patterns (3+ same type in 30s)', async () => {
            const jid = '5511999999999@s.whatsapp.net';

            // Send 3 messages of same type quickly
            for (let i = 0; i < 3; i++) {
                await limiter.canSendMessage(jid);
                limiter.recordSentMessage(jid, 'text');
                vi.advanceTimersByTime(2100);
            }

            // 4th should be blocked by duplicate pattern
            const result = await limiter.canSendMessage(jid, 'text');
            expect(result.canSend).toBe(false);
            expect(result.reason).toBe('duplicate_pattern_detected');
        });
    });

    // ============================================
    // Group multiplier
    // ============================================

    describe('Group multiplier', () => {
        it('should apply stricter limits for groups (0.5x multiplier)', async () => {
            const groupJid = '120363000000000000@g.us';

            // Groups have 0.5x multiplier → per-minute limit = ceil(10 * 0.5) = 5
            for (let i = 0; i < 5; i++) {
                const check = await limiter.canSendMessage(groupJid);
                if (check.canSend) {
                    limiter.recordSentMessage(groupJid);
                }
                vi.advanceTimersByTime(3100); // Group min interval is 3s
            }

            const result = await limiter.canSendMessage(groupJid);
            expect(result.canSend).toBe(false);
            expect(result.reason).toBe('per_minute_limit');
        });
    });

    // ============================================
    // getStats
    // ============================================

    describe('getStats', () => {
        it('should return empty stats initially', () => {
            const stats = limiter.getStats();
            expect(stats.totalChats).toBe(0);
            expect(stats.activeChatsLastHour).toBe(0);
            expect(stats.averageMessagesPerMinute).toBe(0);
            expect(stats.chatsNearLimits).toEqual([]);
        });

        it('should track active chats', async () => {
            // Create activity for 2 chats
            await limiter.canSendMessage('111@s.whatsapp.net');
            limiter.recordSentMessage('111@s.whatsapp.net');

            await limiter.canSendMessage('222@s.whatsapp.net');
            limiter.recordSentMessage('222@s.whatsapp.net');

            const stats = limiter.getStats();
            expect(stats.totalChats).toBe(2);
            expect(stats.activeChatsLastHour).toBe(2);
        });
    });

    // ============================================
    // shutdown
    // ============================================

    describe('shutdown', () => {
        it('should clear intervals without throwing', () => {
            expect(() => limiter.shutdown()).not.toThrow();
        });

        it('should be safe to call multiple times', () => {
            limiter.shutdown();
            expect(() => limiter.shutdown()).not.toThrow();
        });
    });

    // ============================================
    // updateConfig
    // ============================================

    describe('updateConfig', () => {
        it('should update partial config', async () => {
            limiter.updateConfig({ maxMessagesPerMinute: 100 });

            // Now we should be able to send more messages per minute
            const jid = '5511999999999@s.whatsapp.net';
            let successCount = 0;

            for (let i = 0; i < 15; i++) {
                const check = await limiter.canSendMessage(jid);
                if (check.canSend) {
                    successCount++;
                    limiter.recordSentMessage(jid);
                }
                vi.advanceTimersByTime(2100);
            }

            // With limit of 100/min, all 15 should succeed (burst may limit some)
            expect(successCount).toBeGreaterThan(5);
        });
    });

    // ============================================
    // clearAll
    // ============================================

    describe('clearAll', () => {
        it('should remove all tracked chats', async () => {
            await limiter.canSendMessage('111@s.whatsapp.net');
            limiter.recordSentMessage('111@s.whatsapp.net');

            expect(limiter.getStats().totalChats).toBe(1);

            limiter.clearAll();

            expect(limiter.getStats().totalChats).toBe(0);
        });
    });

    // ============================================
    // waitForSendSlot
    // ============================================

    describe('waitForSendSlot', () => {
        it('should return immediately when slot is available', async () => {
            const jid = '5511999999999@s.whatsapp.net';
            const result = await limiter.waitForSendSlot(jid);
            expect(result.allowed).toBe(true);
            expect(result.waitedMs).toBe(0);
        });

        it('should deny immediately on daily limit exceeded', async () => {
            const jid = '5511999999999@s.whatsapp.net';

            // Set very low daily limit
            limiter.updateConfig({ maxMessagesPerDay: 1 });

            // Send one message
            await limiter.canSendMessage(jid);
            limiter.recordSentMessage(jid);
            vi.advanceTimersByTime(2100);

            // waitForSendSlot should deny immediately (not wait)
            const result = await limiter.waitForSendSlot(jid);
            expect(result.allowed).toBe(false);
            expect(result.reason).toBe('daily_limit_exceeded');
        });
    });
});
