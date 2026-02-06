/**
 * Escalation Logic Tests
 * 
 * Critical path: Ensures alerts are created correctly when bot cannot answer
 * and that rate limiting prevents alert spam.
 * 
 * Priority: DO NO HARM
 */

import { describe, it, expect, beforeEach } from 'vitest';

// ============================================
// Test utilities - Extract logic for testing
// ============================================

interface GeminiAnalysis {
    intent: string;
    suggestedTopics: string[];
    confidence: number;
    reason: string;
    canAnswer: boolean;
}

interface PendingAlert {
    id: string;
    chatJid: string;
    customerName: string;
    customerPhone: string;
    originalMessage: string;
    status: 'pending' | 'answered' | 'dismissed';
    priority: 'low' | 'medium' | 'high';
    createdAt: string;
    expiresAt: string;
}

/**
 * Extracted escalation logic from PendingAlertService for unit testing
 */
class EscalationValidator {
    private alerts: PendingAlert[] = [];
    private rateLimitMap: Map<string, number[]> = new Map();

    // Rate limit: max 5 alerts per hour per chat
    private readonly RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
    private readonly RATE_LIMIT_MAX = 5;

    isValidJid(jid: string): boolean {
        if (!jid || typeof jid !== 'string') return false;
        return /^\d+@(s\.whatsapp\.net|g\.us)$/.test(jid.trim());
    }

    determinePriority(analysis: GeminiAnalysis): 'low' | 'medium' | 'high' {
        const highPriorityIntents = ['queja', 'urgente', 'problema', 'error', 'falla', 'cancelar'];
        const mediumPriorityIntents = ['precio', 'cotizacion', 'compra', 'pedido', 'envio'];

        const intent = analysis.intent.toLowerCase();

        if (highPriorityIntents.some(p => intent.includes(p))) {
            return 'high';
        }
        if (mediumPriorityIntents.some(p => intent.includes(p))) {
            return 'medium';
        }
        return 'low';
    }

    checkRateLimit(chatJid: string): boolean {
        const now = Date.now();
        const oneHourAgo = now - this.RATE_LIMIT_WINDOW_MS;

        // Get or create alert timestamps for this chat
        let timestamps = this.rateLimitMap.get(chatJid) || [];
        
        // Filter to only recent timestamps
        timestamps = timestamps.filter(t => t > oneHourAgo);
        this.rateLimitMap.set(chatJid, timestamps);

        return timestamps.length < this.RATE_LIMIT_MAX;
    }

    recordAlert(chatJid: string): void {
        const timestamps = this.rateLimitMap.get(chatJid) || [];
        timestamps.push(Date.now());
        this.rateLimitMap.set(chatJid, timestamps);
    }

    canCreateAlert(
        chatJid: string,
        message: string,
        autoEscalate: boolean
    ): { canCreate: boolean; reason?: string } {
        // Check if auto-escalate is enabled
        if (!autoEscalate) {
            return { canCreate: false, reason: 'auto_escalate_disabled' };
        }

        // Validate JID
        if (!this.isValidJid(chatJid)) {
            return { canCreate: false, reason: 'invalid_jid' };
        }

        // Validate message
        if (!message || message.trim().length === 0) {
            return { canCreate: false, reason: 'empty_message' };
        }

        // Check rate limit
        if (!this.checkRateLimit(chatJid)) {
            return { canCreate: false, reason: 'rate_limited' };
        }

        return { canCreate: true };
    }

    createAlert(
        chatJid: string,
        customerName: string,
        message: string,
        analysis: GeminiAnalysis
    ): PendingAlert {
        const alert: PendingAlert = {
            id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            chatJid: chatJid.trim(),
            customerName: customerName || 'Cliente',
            customerPhone: chatJid.split('@')[0],
            originalMessage: message,
            status: 'pending',
            priority: this.determinePriority(analysis),
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        };

        this.alerts.push(alert);
        this.recordAlert(chatJid);

        return alert;
    }

    getActiveAlerts(): PendingAlert[] {
        return this.alerts.filter(a => a.status === 'pending');
    }

    respondToAlert(alertId: string, response: string): PendingAlert | null {
        const alert = this.alerts.find(a => a.id === alertId);
        if (!alert) return null;
        if (!response || response.trim().length === 0) return null;

        alert.status = 'answered';
        return alert;
    }

    clearAlerts(): void {
        this.alerts = [];
        this.rateLimitMap.clear();
    }
}

// ============================================
// Tests
// ============================================

describe('Escalation Logic', () => {
    let validator: EscalationValidator;

    beforeEach(() => {
        validator = new EscalationValidator();
    });

    describe('Alert creation conditions (CRITICAL)', () => {
        it('should allow alert creation when all conditions met', () => {
            const result = validator.canCreateAlert(
                '5491234567890@s.whatsapp.net',
                'Question that cannot be answered',
                true // autoEscalate enabled
            );

            expect(result.canCreate).toBe(true);
        });

        it('should NOT create alert when autoEscalate is disabled', () => {
            const result = validator.canCreateAlert(
                '5491234567890@s.whatsapp.net',
                'Question',
                false // autoEscalate disabled
            );

            expect(result.canCreate).toBe(false);
            expect(result.reason).toBe('auto_escalate_disabled');
        });

        it('should NOT create alert with invalid JID', () => {
            const result = validator.canCreateAlert(
                'invalid-jid',
                'Question',
                true
            );

            expect(result.canCreate).toBe(false);
            expect(result.reason).toBe('invalid_jid');
        });

        it('should NOT create alert with empty message', () => {
            const result = validator.canCreateAlert(
                '5491234567890@s.whatsapp.net',
                '',
                true
            );

            expect(result.canCreate).toBe(false);
            expect(result.reason).toBe('empty_message');
        });
    });

    describe('Rate limiting (CRITICAL - prevents spam)', () => {
        it('should allow up to 5 alerts per hour per chat', () => {
            const jid = '5491234567890@s.whatsapp.net';
            const analysis: GeminiAnalysis = {
                intent: 'consulta_general',
                suggestedTopics: [],
                confidence: 0.3,
                reason: 'No match',
                canAnswer: false
            };

            // Create 5 alerts (should all succeed)
            for (let i = 0; i < 5; i++) {
                const canCreate = validator.canCreateAlert(jid, `Message ${i}`, true);
                expect(canCreate.canCreate).toBe(true);
                validator.createAlert(jid, 'Test User', `Message ${i}`, analysis);
            }

            // 6th alert should be rate limited
            const result = validator.canCreateAlert(jid, 'Message 6', true);
            expect(result.canCreate).toBe(false);
            expect(result.reason).toBe('rate_limited');
        });

        it('should track rate limits per chat independently', () => {
            const jid1 = '5491234567890@s.whatsapp.net';
            const jid2 = '5491111111111@s.whatsapp.net';
            const analysis: GeminiAnalysis = {
                intent: 'consulta',
                suggestedTopics: [],
                confidence: 0.3,
                reason: 'No match',
                canAnswer: false
            };

            // Max out jid1
            for (let i = 0; i < 5; i++) {
                validator.createAlert(jid1, 'User 1', `Message ${i}`, analysis);
            }

            // jid2 should still be able to create alerts
            const result = validator.canCreateAlert(jid2, 'Message', true);
            expect(result.canCreate).toBe(true);
        });
    });

    describe('Priority determination', () => {
        it('should assign HIGH priority for complaints', () => {
            const analysis: GeminiAnalysis = {
                intent: 'queja_servicio',
                suggestedTopics: [],
                confidence: 0.5,
                reason: 'Complaint detected',
                canAnswer: false
            };

            expect(validator.determinePriority(analysis)).toBe('high');
        });

        it('should assign HIGH priority for urgent issues', () => {
            const analysis: GeminiAnalysis = {
                intent: 'problema_urgente',
                suggestedTopics: [],
                confidence: 0.5,
                reason: 'Urgent issue',
                canAnswer: false
            };

            expect(validator.determinePriority(analysis)).toBe('high');
        });

        it('should assign MEDIUM priority for purchase inquiries', () => {
            const analysis: GeminiAnalysis = {
                intent: 'consulta_precio',
                suggestedTopics: [],
                confidence: 0.5,
                reason: 'Price inquiry',
                canAnswer: false
            };

            expect(validator.determinePriority(analysis)).toBe('medium');
        });

        it('should assign LOW priority for general inquiries', () => {
            const analysis: GeminiAnalysis = {
                intent: 'consulta_general',
                suggestedTopics: [],
                confidence: 0.5,
                reason: 'General inquiry',
                canAnswer: false
            };

            expect(validator.determinePriority(analysis)).toBe('low');
        });
    });

    describe('Alert response handling', () => {
        it('should update alert status when responded', () => {
            const analysis: GeminiAnalysis = {
                intent: 'consulta',
                suggestedTopics: [],
                confidence: 0.3,
                reason: 'No match',
                canAnswer: false
            };

            const alert = validator.createAlert(
                '5491234567890@s.whatsapp.net',
                'Test User',
                'Original question',
                analysis
            );

            expect(alert.status).toBe('pending');

            const responded = validator.respondToAlert(alert.id, 'Response from human');

            expect(responded).not.toBeNull();
            expect(responded!.status).toBe('answered');
        });

        it('should NOT respond to non-existent alert', () => {
            const result = validator.respondToAlert('non-existent-id', 'Response');
            expect(result).toBeNull();
        });

        it('should NOT respond with empty response', () => {
            const analysis: GeminiAnalysis = {
                intent: 'consulta',
                suggestedTopics: [],
                confidence: 0.3,
                reason: 'No match',
                canAnswer: false
            };

            const alert = validator.createAlert(
                '5491234567890@s.whatsapp.net',
                'Test User',
                'Question',
                analysis
            );

            const result = validator.respondToAlert(alert.id, '');
            expect(result).toBeNull();
            expect(alert.status).toBe('pending'); // Status unchanged
        });
    });
});
