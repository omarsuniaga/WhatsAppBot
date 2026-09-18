/**
 * ConversationContextService - Fase A of docs/SPEC_CONVERSACION_GUIADA.md
 * Tracks a lightweight, per-chat contact profile and conversation summary
 * so the bot can greet contacts appropriately and detect basic intent,
 * without storing the full message history (see spec section 4).
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { EventEmitter } from 'events';

export type RelationType = 'cliente_hotel' | 'amigo' | 'alumno' | 'institucional' | 'desconocido';

export type ConversationState =
    | 'nuevo_contacto'
    | 'conversacion_general'
    | 'escalado_humano';

export interface DetectedIntent {
    label: string;
    confidence: number;
    entities: Record<string, string>;
}

export interface ContactProfile {
    displayName: string;
    relationType: RelationType;
    preferredLanguage: 'es' | 'en';
    tags: string[];
}

export interface ConversationContext {
    chatJid: string;
    contactProfile: ContactProfile;
    state: ConversationState;
    detectedIntent?: DetectedIntent;
    lastInboundAt: string | null;
    lastOutboundAt: string | null;
    summary: string;
    messageCountSinceSummary: number;
    optedOut: boolean;
    createdAt: string;
    updatedAt: string;
}

interface ConversationContextData {
    version: number;
    contexts: Record<string, ConversationContext>;
}

const DATA_PATH = join(process.cwd(), 'data', 'conversation-context.json');

// Regenerate the rolling summary every N inbound messages (spec section 4)
const SUMMARY_REGEN_INTERVAL = 10;
const MAX_SUMMARY_LENGTH = 500;
const MAX_NAME_LENGTH = 100;
const MAX_MESSAGE_SNIPPET_LENGTH = 200;

class ConversationContextService extends EventEmitter {
    private static instance: ConversationContextService;
    private data: ConversationContextData;

    private constructor() {
        super();
        this.data = this.load();
    }

    static getInstance(): ConversationContextService {
        if (!ConversationContextService.instance) {
            ConversationContextService.instance = new ConversationContextService();
        }
        return ConversationContextService.instance;
    }

    private load(): ConversationContextData {
        try {
            if (existsSync(DATA_PATH)) {
                return JSON.parse(readFileSync(DATA_PATH, 'utf-8'));
            }
        } catch (error) {
            console.error('[ConversationContextService] Error loading data:', error);
        }

        return { version: 1, contexts: {} };
    }

    private save(): void {
        try {
            const dir = dirname(DATA_PATH);
            if (!existsSync(dir)) {
                mkdirSync(dir, { recursive: true });
            }
            writeFileSync(DATA_PATH, JSON.stringify(this.data, null, 2));
        } catch (error) {
            console.error('[ConversationContextService] Error saving data:', error);
        }
    }

    private isValidJid(jid: string): boolean {
        return typeof jid === 'string' && /^\d+@(s\.whatsapp\.net|g\.us)$/.test(jid.trim());
    }

    private sanitizeName(name: string): string {
        if (!name || typeof name !== 'string') return 'Contacto';
        return name.trim().replace(/[<>"'&]/g, '').slice(0, MAX_NAME_LENGTH) || 'Contacto';
    }

    /**
     * Get an existing context, or create a fresh one for a new contact.
     */
    getOrCreateContext(jid: string, displayName: string): ConversationContext | null {
        if (!this.isValidJid(jid)) return null;

        const existing = this.data.contexts[jid];
        if (existing) return existing;

        const now = new Date().toISOString();
        const context: ConversationContext = {
            chatJid: jid,
            contactProfile: {
                displayName: this.sanitizeName(displayName),
                relationType: 'desconocido',
                preferredLanguage: 'es',
                tags: []
            },
            state: 'nuevo_contacto',
            lastInboundAt: null,
            lastOutboundAt: null,
            summary: '',
            messageCountSinceSummary: 0,
            optedOut: false,
            createdAt: now,
            updatedAt: now
        };

        this.data.contexts[jid] = context;
        this.save();
        this.emit('context:created', context);
        return context;
    }

    getContext(jid: string): ConversationContext | null {
        return this.data.contexts[jid] || null;
    }

    getAllContexts(): ConversationContext[] {
        return Object.values(this.data.contexts);
    }

    /**
     * Append a short snippet to the rolling summary instead of keeping full
     * history, regenerating it every SUMMARY_REGEN_INTERVAL messages so it
     * never grows unbounded (spec section 4).
     */
    private appendToSummary(context: ConversationContext, role: 'customer' | 'bot', message: string): void {
        const snippet = message.trim().slice(0, MAX_MESSAGE_SNIPPET_LENGTH);
        const line = `${role === 'customer' ? 'Cliente' : 'Bot'}: ${snippet}`;

        context.messageCountSinceSummary++;

        if (context.messageCountSinceSummary >= SUMMARY_REGEN_INTERVAL) {
            // Reset to just the latest line; a future Fase could call Gemini
            // here to produce a real abstractive summary.
            context.summary = line;
            context.messageCountSinceSummary = 0;
        } else {
            const combined = context.summary ? `${context.summary}\n${line}` : line;
            context.summary = combined.slice(-MAX_SUMMARY_LENGTH);
        }
    }

    /**
     * Record an inbound (customer) message, updating state, summary and
     * detected intent.
     */
    recordInboundMessage(
        jid: string,
        displayName: string,
        message: string,
        detectedIntent?: DetectedIntent
    ): ConversationContext | null {
        const context = this.getOrCreateContext(jid, displayName);
        if (!context) return null;

        if (context.state === 'nuevo_contacto') {
            context.state = 'conversacion_general';
        }

        context.lastInboundAt = new Date().toISOString();
        context.updatedAt = context.lastInboundAt;
        if (detectedIntent) {
            context.detectedIntent = detectedIntent;
        }
        this.appendToSummary(context, 'customer', message);

        this.save();
        this.emit('context:updated', context);
        return context;
    }

    /**
     * Record an outbound (bot/human) message.
     */
    recordOutboundMessage(jid: string, message: string): ConversationContext | null {
        const context = this.getContext(jid);
        if (!context) return null;

        context.lastOutboundAt = new Date().toISOString();
        context.updatedAt = context.lastOutboundAt;
        this.appendToSummary(context, 'bot', message);

        this.save();
        this.emit('context:updated', context);
        return context;
    }

    /**
     * Mark a conversation as escalated to a human (mirrors PendingAlertService).
     */
    markEscalated(jid: string): void {
        const context = this.getContext(jid);
        if (!context) return;
        context.state = 'escalado_humano';
        context.updatedAt = new Date().toISOString();
        this.save();
        this.emit('context:updated', context);
    }

    /**
     * Update the editable part of a contact profile from the dashboard.
     */
    updateProfile(jid: string, updates: Partial<ContactProfile>): ConversationContext | null {
        const context = this.getContext(jid);
        if (!context) return null;

        if (updates.displayName !== undefined) {
            context.contactProfile.displayName = this.sanitizeName(updates.displayName);
        }
        if (updates.relationType !== undefined) {
            context.contactProfile.relationType = updates.relationType;
        }
        if (updates.preferredLanguage !== undefined) {
            context.contactProfile.preferredLanguage = updates.preferredLanguage;
        }
        if (updates.tags !== undefined) {
            context.contactProfile.tags = updates.tags.slice(0, 20).map(t => t.trim().slice(0, 50)).filter(Boolean);
        }

        context.updatedAt = new Date().toISOString();
        this.save();
        this.emit('context:updated', context);
        return context;
    }

    /**
     * Permanently opt a contact out of any future follow-up/re-engagement
     * suggestions (spec section 7 and 10). This never gets cleared automatically.
     */
    setOptedOut(jid: string, optedOut: boolean): ConversationContext | null {
        const context = this.getContext(jid);
        if (!context) return null;
        context.optedOut = optedOut;
        context.updatedAt = new Date().toISOString();
        this.save();
        this.emit('context:updated', context);
        return context;
    }
}

export default ConversationContextService;
