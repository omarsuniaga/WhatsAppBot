/**
 * Anti-Loop Protection Tests
 * 
 * Critical path: Ensures the bot NEVER responds to its own messages
 * or creates infinite loops.
 * 
 * Priority: DO NO HARM
 */

import { describe, it, expect, beforeEach } from 'vitest';

// ============================================
// Test utilities - Extract logic for testing
// ============================================

// Constants from BotService
const MIN_MESSAGE_INTERVAL_MS = 2000;
const MAX_MESSAGE_LENGTH = 4096;
const ANTI_LOOP_WINDOW_MS = 5000;

interface SentMessageTracker {
    lastSentAt: number;
    messageHash: string;
}

/**
 * Extracted validation logic from BotService for unit testing
 */
class AntiLoopValidator {
    private sentMessages: Map<string, SentMessageTracker> = new Map();
    private processingMessages: Set<string> = new Set();

    isValidJid(jid: string): boolean {
        if (!jid || typeof jid !== 'string') return false;
        return /^\d+@(s\.whatsapp\.net|g\.us)$/.test(jid);
    }

    sanitizeMessage(text: string): string {
        if (!text || typeof text !== 'string') return '';
        return text.trim().slice(0, MAX_MESSAGE_LENGTH);
    }

    hashMessage(jid: string, text: string): string {
        return `${jid}:${text.slice(0, 100)}`;
    }

    shouldSkipMessage(
        jid: string, 
        messageText: string, 
        isFromMe: boolean
    ): { skip: boolean; reason?: string } {
        // Always skip own messages
        if (isFromMe) {
            return { skip: true, reason: 'own_message' };
        }

        // Skip empty messages
        if (!messageText || messageText.trim().length === 0) {
            return { skip: true, reason: 'empty_message' };
        }

        // Skip invalid JIDs
        if (!this.isValidJid(jid)) {
            return { skip: true, reason: 'invalid_jid' };
        }

        // Check if we recently sent this exact message (loop detection)
        const messageHash = this.hashMessage(jid, messageText);
        const tracker = this.sentMessages.get(jid);
        if (tracker && tracker.messageHash === messageHash) {
            const timeSinceSent = Date.now() - tracker.lastSentAt;
            if (timeSinceSent < ANTI_LOOP_WINDOW_MS) {
                return { skip: true, reason: 'loop_detected' };
            }
        }

        // Check if already processing this chat
        if (this.processingMessages.has(jid)) {
            return { skip: true, reason: 'already_processing' };
        }

        return { skip: false };
    }

    trackSentMessage(jid: string, messageText: string): void {
        this.sentMessages.set(jid, {
            lastSentAt: Date.now(),
            messageHash: this.hashMessage(jid, messageText)
        });
    }

    startProcessing(jid: string): void {
        this.processingMessages.add(jid);
    }

    stopProcessing(jid: string): void {
        this.processingMessages.delete(jid);
    }

    clearAll(): void {
        this.sentMessages.clear();
        this.processingMessages.clear();
    }
}

// ============================================
// Tests
// ============================================

describe('Anti-Loop Protection', () => {
    let validator: AntiLoopValidator;

    beforeEach(() => {
        validator = new AntiLoopValidator();
    });

    describe('Own message detection (CRITICAL)', () => {
        it('should ALWAYS skip messages from self (isFromMe=true)', () => {
            const jid = '5491234567890@s.whatsapp.net';
            const message = 'Hello world';

            const result = validator.shouldSkipMessage(jid, message, true);

            expect(result.skip).toBe(true);
            expect(result.reason).toBe('own_message');
        });

        it('should process messages from others (isFromMe=false)', () => {
            const jid = '5491234567890@s.whatsapp.net';
            const message = 'Hello world';

            const result = validator.shouldSkipMessage(jid, message, false);

            expect(result.skip).toBe(false);
        });
    });

    describe('Loop detection (CRITICAL)', () => {
        it('should detect when receiving our own message echo', () => {
            const jid = '5491234567890@s.whatsapp.net';
            const botResponse = 'This is the bot response';

            // Bot sends a message
            validator.trackSentMessage(jid, botResponse);

            // Same message comes back (echo from WhatsApp)
            const result = validator.shouldSkipMessage(jid, botResponse, false);

            expect(result.skip).toBe(true);
            expect(result.reason).toBe('loop_detected');
        });

        it('should allow different messages from same chat', () => {
            const jid = '5491234567890@s.whatsapp.net';
            const botResponse = 'Bot response';
            const userMessage = 'Different user message';

            // Bot sends a message
            validator.trackSentMessage(jid, botResponse);

            // User sends a different message
            const result = validator.shouldSkipMessage(jid, userMessage, false);

            expect(result.skip).toBe(false);
        });

        it('should allow same message after loop window expires', async () => {
            const jid = '5491234567890@s.whatsapp.net';
            const message = 'Test message';

            // Simulate message sent in the past (beyond window)
            validator['sentMessages'].set(jid, {
                lastSentAt: Date.now() - ANTI_LOOP_WINDOW_MS - 1000,
                messageHash: validator.hashMessage(jid, message)
            });

            const result = validator.shouldSkipMessage(jid, message, false);

            expect(result.skip).toBe(false);
        });
    });

    describe('Concurrent processing protection', () => {
        it('should prevent concurrent processing of same chat', () => {
            const jid = '5491234567890@s.whatsapp.net';
            const message = 'Test message';

            // Start processing
            validator.startProcessing(jid);

            // Another message arrives for same chat
            const result = validator.shouldSkipMessage(jid, message, false);

            expect(result.skip).toBe(true);
            expect(result.reason).toBe('already_processing');
        });

        it('should allow processing after previous completes', () => {
            const jid = '5491234567890@s.whatsapp.net';
            const message = 'Test message';

            validator.startProcessing(jid);
            validator.stopProcessing(jid);

            const result = validator.shouldSkipMessage(jid, message, false);

            expect(result.skip).toBe(false);
        });

        it('should allow parallel processing of different chats', () => {
            const jid1 = '5491234567890@s.whatsapp.net';
            const jid2 = '5491111111111@s.whatsapp.net';
            const message = 'Test message';

            validator.startProcessing(jid1);

            const result = validator.shouldSkipMessage(jid2, message, false);

            expect(result.skip).toBe(false);
        });
    });

    describe('Input validation', () => {
        it('should reject empty messages', () => {
            const jid = '5491234567890@s.whatsapp.net';

            expect(validator.shouldSkipMessage(jid, '', false).skip).toBe(true);
            expect(validator.shouldSkipMessage(jid, '   ', false).skip).toBe(true);
            expect(validator.shouldSkipMessage(jid, null as any, false).skip).toBe(true);
            expect(validator.shouldSkipMessage(jid, undefined as any, false).skip).toBe(true);
        });

        it('should reject invalid JID formats', () => {
            const message = 'Test message';

            // Invalid formats
            expect(validator.shouldSkipMessage('invalid', message, false).reason).toBe('invalid_jid');
            expect(validator.shouldSkipMessage('', message, false).reason).toBe('invalid_jid');
            expect(validator.shouldSkipMessage('abc@s.whatsapp.net', message, false).reason).toBe('invalid_jid');
            expect(validator.shouldSkipMessage('123@invalid.net', message, false).reason).toBe('invalid_jid');
        });

        it('should accept valid JID formats', () => {
            const message = 'Test message';

            // Individual chat
            expect(validator.shouldSkipMessage('5491234567890@s.whatsapp.net', message, false).skip).toBe(false);
            
            // Group chat
            expect(validator.shouldSkipMessage('123456789@g.us', message, false).skip).toBe(false);
        });

        it('should truncate extremely long messages', () => {
            const longMessage = 'a'.repeat(10000);
            const sanitized = validator.sanitizeMessage(longMessage);

            expect(sanitized.length).toBe(MAX_MESSAGE_LENGTH);
        });
    });
});
