/**
 * Bot Assignment Handling Tests
 * 
 * Critical path: Ensures bot respects per-chat configuration
 * and correctly enables/disables based on assignment.
 * 
 * Priority: DO NO HARM
 */

import { describe, it, expect, beforeEach } from 'vitest';

// ============================================
// Test utilities - Extract logic for testing
// ============================================

interface BotConfig {
    enabled: boolean;
    personality: 'professional' | 'friendly' | 'formal';
    language: string;
    customGreeting?: string;
    customFallback?: string;
    autoEscalate: boolean;
    escalateThreshold: number;
    learningEnabled: boolean;
}

interface BotAssignment {
    id: string;
    chatJid: string;
    chatName: string;
    isGroup: boolean;
    botConfig: BotConfig;
    createdAt: string;
    updatedAt: string;
}

const DEFAULT_BOT_CONFIG: BotConfig = {
    enabled: false, // Default is OFF - safe default
    personality: 'friendly',
    language: 'es',
    customGreeting: '¡Hola! Soy el asistente virtual.',
    customFallback: 'Un momento, estoy consultando con mi equipo.',
    autoEscalate: true,
    escalateThreshold: 0.7,
    learningEnabled: true
};

/**
 * Extracted assignment logic from BotAssignmentService for unit testing
 */
class BotAssignmentValidator {
    private assignments: Map<string, BotAssignment> = new Map();
    private defaultConfig: BotConfig = { ...DEFAULT_BOT_CONFIG };

    getAssignment(chatJid: string): BotAssignment | null {
        return this.assignments.get(chatJid) || null;
    }

    getDefaultConfig(): BotConfig {
        return { ...this.defaultConfig };
    }

    createAssignment(
        chatJid: string,
        chatName: string,
        isGroup: boolean = false,
        config?: Partial<BotConfig>
    ): BotAssignment {
        const existing = this.getAssignment(chatJid);
        if (existing) {
            return existing;
        }

        const assignment: BotAssignment = {
            id: `assign-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            chatJid,
            chatName,
            isGroup,
            botConfig: {
                ...this.defaultConfig,
                ...config
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.assignments.set(chatJid, assignment);
        return assignment;
    }

    updateAssignment(chatJid: string, updates: Partial<BotConfig>): BotAssignment | null {
        const assignment = this.getAssignment(chatJid);
        if (!assignment) {
            return null;
        }

        assignment.botConfig = { ...assignment.botConfig, ...updates };
        assignment.updatedAt = new Date().toISOString();
        return assignment;
    }

    toggleBot(chatJid: string, enabled: boolean, chatName?: string): BotAssignment | null {
        let assignment = this.getAssignment(chatJid);

        if (!assignment && chatName) {
            assignment = this.createAssignment(chatJid, chatName);
        }

        if (assignment) {
            assignment.botConfig.enabled = enabled;
            assignment.updatedAt = new Date().toISOString();
        }

        return assignment;
    }

    isBotActive(chatJid: string): boolean {
        const assignment = this.getAssignment(chatJid);
        return assignment?.botConfig.enabled ?? false;
    }

    shouldBotRespond(
        chatJid: string,
        isFromMe: boolean,
        globalEnabled: boolean
    ): { shouldRespond: boolean; reason?: string } {
        // Global kill switch
        if (!globalEnabled) {
            return { shouldRespond: false, reason: 'global_disabled' };
        }

        // Never respond to own messages
        if (isFromMe) {
            return { shouldRespond: false, reason: 'own_message' };
        }

        // Check per-chat assignment
        const assignment = this.getAssignment(chatJid);
        if (assignment && !assignment.botConfig.enabled) {
            return { shouldRespond: false, reason: 'chat_disabled' };
        }

        // No assignment means use default (which is disabled by default)
        if (!assignment) {
            return { shouldRespond: false, reason: 'no_assignment' };
        }

        return { shouldRespond: true };
    }

    clearAssignments(): void {
        this.assignments.clear();
    }
}

// ============================================
// Tests
// ============================================

describe('Bot Assignment Handling', () => {
    let validator: BotAssignmentValidator;

    beforeEach(() => {
        validator = new BotAssignmentValidator();
    });

    describe('Default behavior (CRITICAL - safe defaults)', () => {
        it('should have bot DISABLED by default', () => {
            const defaultConfig = validator.getDefaultConfig();
            expect(defaultConfig.enabled).toBe(false);
        });

        it('should NOT respond when no assignment exists', () => {
            const result = validator.shouldBotRespond(
                '5491234567890@s.whatsapp.net',
                false, // not from self
                true   // global enabled
            );

            expect(result.shouldRespond).toBe(false);
            expect(result.reason).toBe('no_assignment');
        });

        it('should NOT respond when assignment exists but bot is disabled', () => {
            const jid = '5491234567890@s.whatsapp.net';
            
            // Create assignment with bot disabled (default)
            validator.createAssignment(jid, 'Test Chat');

            const result = validator.shouldBotRespond(jid, false, true);

            expect(result.shouldRespond).toBe(false);
            expect(result.reason).toBe('chat_disabled');
        });
    });

    describe('Global kill switch (CRITICAL)', () => {
        it('should NOT respond when global is disabled, even if chat is enabled', () => {
            const jid = '5491234567890@s.whatsapp.net';
            
            // Create assignment with bot enabled
            validator.createAssignment(jid, 'Test Chat', false, { enabled: true });

            const result = validator.shouldBotRespond(
                jid,
                false,
                false // global DISABLED
            );

            expect(result.shouldRespond).toBe(false);
            expect(result.reason).toBe('global_disabled');
        });
    });

    describe('Per-chat bot toggle', () => {
        it('should enable bot for specific chat', () => {
            const jid = '5491234567890@s.whatsapp.net';

            // Start disabled
            expect(validator.isBotActive(jid)).toBe(false);

            // Toggle on
            validator.toggleBot(jid, true, 'Test Chat');

            expect(validator.isBotActive(jid)).toBe(true);
        });

        it('should disable bot for specific chat', () => {
            const jid = '5491234567890@s.whatsapp.net';

            // Create enabled
            validator.createAssignment(jid, 'Test Chat', false, { enabled: true });
            expect(validator.isBotActive(jid)).toBe(true);

            // Toggle off
            validator.toggleBot(jid, false);

            expect(validator.isBotActive(jid)).toBe(false);
        });

        it('should not affect other chats when toggling one', () => {
            const jid1 = '5491234567890@s.whatsapp.net';
            const jid2 = '5491111111111@s.whatsapp.net';

            // Enable both
            validator.createAssignment(jid1, 'Chat 1', false, { enabled: true });
            validator.createAssignment(jid2, 'Chat 2', false, { enabled: true });

            // Disable one
            validator.toggleBot(jid1, false);

            expect(validator.isBotActive(jid1)).toBe(false);
            expect(validator.isBotActive(jid2)).toBe(true);
        });
    });

    describe('Assignment configuration', () => {
        it('should create assignment with custom config', () => {
            const jid = '5491234567890@s.whatsapp.net';
            
            const assignment = validator.createAssignment(jid, 'Test Chat', false, {
                enabled: true,
                personality: 'formal',
                escalateThreshold: 0.5
            });

            expect(assignment.botConfig.enabled).toBe(true);
            expect(assignment.botConfig.personality).toBe('formal');
            expect(assignment.botConfig.escalateThreshold).toBe(0.5);
            // Should keep default values for unspecified fields
            expect(assignment.botConfig.language).toBe('es');
        });

        it('should update existing assignment', () => {
            const jid = '5491234567890@s.whatsapp.net';
            
            validator.createAssignment(jid, 'Test Chat');
            
            const updated = validator.updateAssignment(jid, {
                personality: 'professional',
                autoEscalate: false
            });

            expect(updated).not.toBeNull();
            expect(updated!.botConfig.personality).toBe('professional');
            expect(updated!.botConfig.autoEscalate).toBe(false);
        });

        it('should NOT duplicate assignment for same chat', () => {
            const jid = '5491234567890@s.whatsapp.net';
            
            const first = validator.createAssignment(jid, 'Chat 1', false, { enabled: true });
            const second = validator.createAssignment(jid, 'Chat 2', false, { enabled: false });

            // Should return same assignment
            expect(first.id).toBe(second.id);
            // Original config should be preserved
            expect(first.botConfig.enabled).toBe(true);
        });
    });

    describe('Response decision flow (CRITICAL)', () => {
        it('should respond when all conditions are met', () => {
            const jid = '5491234567890@s.whatsapp.net';
            
            // Create enabled assignment
            validator.createAssignment(jid, 'Test Chat', false, { enabled: true });

            const result = validator.shouldBotRespond(
                jid,
                false, // not from self
                true   // global enabled
            );

            expect(result.shouldRespond).toBe(true);
        });

        it('should NEVER respond to own messages regardless of config', () => {
            const jid = '5491234567890@s.whatsapp.net';
            
            // Create enabled assignment
            validator.createAssignment(jid, 'Test Chat', false, { enabled: true });

            const result = validator.shouldBotRespond(
                jid,
                true,  // FROM SELF
                true   // global enabled
            );

            expect(result.shouldRespond).toBe(false);
            expect(result.reason).toBe('own_message');
        });
    });

    describe('Group vs Individual chat handling', () => {
        it('should track group status correctly', () => {
            const groupJid = '123456789@g.us';
            const individualJid = '5491234567890@s.whatsapp.net';

            const groupAssignment = validator.createAssignment(groupJid, 'Test Group', true);
            const individualAssignment = validator.createAssignment(individualJid, 'Test User', false);

            expect(groupAssignment.isGroup).toBe(true);
            expect(individualAssignment.isGroup).toBe(false);
        });
    });
});
