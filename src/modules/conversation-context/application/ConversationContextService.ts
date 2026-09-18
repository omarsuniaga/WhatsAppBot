/**
 * Application layer — use cases for the conversation-context module.
 *
 * Depends only on the `ConversationContextRepository` port, never on the
 * concrete JSON adapter. Driving adapters (BotOrchestrator, the Express
 * controller) call this service and never touch the domain functions or
 * the repository directly.
 */
import { EventEmitter } from 'events';
import {
    ConversationContext,
    ContactProfile,
    DetectedIntent,
    createContext,
    recordInbound,
    recordOutbound,
    markEscalated as domainMarkEscalated,
    updateProfile as domainUpdateProfile,
    setOptedOut as domainSetOptedOut
} from '../domain/ConversationContext';
import { ConversationContextRepository } from '../domain/ports';
import { JsonConversationContextRepository } from '../infrastructure/JsonConversationContextRepository';

class ConversationContextService extends EventEmitter {
    private static instance: ConversationContextService;

    constructor(private readonly repository: ConversationContextRepository) {
        super();
    }

    static getInstance(): ConversationContextService {
        if (!ConversationContextService.instance) {
            ConversationContextService.instance = new ConversationContextService(
                new JsonConversationContextRepository()
            );
        }
        return ConversationContextService.instance;
    }

    private isValidJid(jid: string): boolean {
        return typeof jid === 'string' && /^\d+@(s\.whatsapp\.net|g\.us)$/.test(jid.trim());
    }

    getOrCreateContext(jid: string, displayName: string): ConversationContext | null {
        if (!this.isValidJid(jid)) return null;

        const existing = this.repository.findByJid(jid);
        if (existing) return existing;

        const context = createContext(jid, displayName);
        this.repository.save(context);
        this.emit('context:created', context);
        return context;
    }

    getContext(jid: string): ConversationContext | null {
        return this.repository.findByJid(jid);
    }

    getAllContexts(): ConversationContext[] {
        return this.repository.findAll();
    }

    recordInboundMessage(
        jid: string,
        displayName: string,
        message: string,
        detectedIntent?: DetectedIntent
    ): ConversationContext | null {
        const context = this.getOrCreateContext(jid, displayName);
        if (!context) return null;

        recordInbound(context, message, detectedIntent);
        this.repository.save(context);
        this.emit('context:updated', context);
        return context;
    }

    recordOutboundMessage(jid: string, message: string): ConversationContext | null {
        const context = this.repository.findByJid(jid);
        if (!context) return null;

        recordOutbound(context, message);
        this.repository.save(context);
        this.emit('context:updated', context);
        return context;
    }

    markEscalated(jid: string): void {
        const context = this.repository.findByJid(jid);
        if (!context) return;

        domainMarkEscalated(context);
        this.repository.save(context);
        this.emit('context:updated', context);
    }

    updateProfile(jid: string, updates: Partial<ContactProfile>): ConversationContext | null {
        const context = this.repository.findByJid(jid);
        if (!context) return null;

        domainUpdateProfile(context, updates);
        this.repository.save(context);
        this.emit('context:updated', context);
        return context;
    }

    setOptedOut(jid: string, optedOut: boolean): ConversationContext | null {
        const context = this.repository.findByJid(jid);
        if (!context) return null;

        domainSetOptedOut(context, optedOut);
        this.repository.save(context);
        this.emit('context:updated', context);
        return context;
    }
}

export default ConversationContextService;
export type { ConversationContext, ContactProfile, DetectedIntent, RelationType, ConversationState } from '../domain/ConversationContext';
