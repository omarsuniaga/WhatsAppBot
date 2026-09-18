/**
 * Domain layer — ConversationContext (Fase A of docs/SPEC_CONVERSACION_GUIADA.md)
 *
 * Pure business logic: no filesystem, no Express, no framework imports.
 * This is the part of the module that encodes the actual rules (how a
 * contact profile evolves, how the rolling summary is kept bounded) and
 * can be unit-tested without any I/O.
 */

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

// Regenerate the rolling summary every N inbound messages (spec section 4)
export const SUMMARY_REGEN_INTERVAL = 10;
export const MAX_SUMMARY_LENGTH = 500;
export const MAX_NAME_LENGTH = 100;
export const MAX_MESSAGE_SNIPPET_LENGTH = 200;
export const MAX_TAGS = 20;
export const MAX_TAG_LENGTH = 50;

const VALID_RELATION_TYPES: RelationType[] = ['cliente_hotel', 'amigo', 'alumno', 'institucional', 'desconocido'];
const VALID_LANGUAGES: ContactProfile['preferredLanguage'][] = ['es', 'en'];

export function isValidRelationType(value: unknown): value is RelationType {
    return typeof value === 'string' && VALID_RELATION_TYPES.includes(value as RelationType);
}

export function isValidLanguage(value: unknown): value is ContactProfile['preferredLanguage'] {
    return typeof value === 'string' && VALID_LANGUAGES.includes(value as ContactProfile['preferredLanguage']);
}

export function sanitizeName(name: string): string {
    if (!name || typeof name !== 'string') return 'Contacto';
    return name.trim().replace(/[<>"'&]/g, '').slice(0, MAX_NAME_LENGTH) || 'Contacto';
}

export function sanitizeTags(tags: string[]): string[] {
    return tags.slice(0, MAX_TAGS).map(t => t.trim().slice(0, MAX_TAG_LENGTH)).filter(Boolean);
}

/**
 * Create a fresh context for a contact we've never seen before.
 */
export function createContext(jid: string, displayName: string, now: string = new Date().toISOString()): ConversationContext {
    return {
        chatJid: jid,
        contactProfile: {
            displayName: sanitizeName(displayName),
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
}

/**
 * Append a short snippet to the rolling summary instead of keeping full
 * history, regenerating it every SUMMARY_REGEN_INTERVAL messages so it
 * never grows unbounded (spec section 4).
 */
function appendToSummary(context: ConversationContext, role: 'customer' | 'bot', message: string): void {
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
 * detected intent. Mutates and returns the same context instance so
 * callers can persist it directly.
 */
export function recordInbound(
    context: ConversationContext,
    message: string,
    detectedIntent: DetectedIntent | undefined,
    now: string = new Date().toISOString()
): ConversationContext {
    if (context.state === 'nuevo_contacto') {
        context.state = 'conversacion_general';
    }

    context.lastInboundAt = now;
    context.updatedAt = now;
    if (detectedIntent) {
        context.detectedIntent = detectedIntent;
    }
    appendToSummary(context, 'customer', message);

    return context;
}

/**
 * Record an outbound (bot/human) message.
 */
export function recordOutbound(
    context: ConversationContext,
    message: string,
    now: string = new Date().toISOString()
): ConversationContext {
    context.lastOutboundAt = now;
    context.updatedAt = now;
    appendToSummary(context, 'bot', message);

    return context;
}

/**
 * Mark a conversation as escalated to a human (mirrors PendingAlertService).
 */
export function markEscalated(context: ConversationContext, now: string = new Date().toISOString()): ConversationContext {
    context.state = 'escalado_humano';
    context.updatedAt = now;
    return context;
}

/**
 * Update the editable part of a contact profile from the dashboard.
 */
export function updateProfile(
    context: ConversationContext,
    updates: Partial<ContactProfile>,
    now: string = new Date().toISOString()
): ConversationContext {
    if (updates.displayName !== undefined) {
        context.contactProfile.displayName = sanitizeName(updates.displayName);
    }
    if (updates.relationType !== undefined) {
        context.contactProfile.relationType = updates.relationType;
    }
    if (updates.preferredLanguage !== undefined) {
        context.contactProfile.preferredLanguage = updates.preferredLanguage;
    }
    if (updates.tags !== undefined) {
        context.contactProfile.tags = sanitizeTags(updates.tags);
    }

    context.updatedAt = now;
    return context;
}

/**
 * Permanently opt a contact out of any future follow-up/re-engagement
 * suggestions (spec section 7 and 10). This never gets cleared automatically.
 */
export function setOptedOut(
    context: ConversationContext,
    optedOut: boolean,
    now: string = new Date().toISOString()
): ConversationContext {
    context.optedOut = optedOut;
    context.updatedAt = now;
    return context;
}
