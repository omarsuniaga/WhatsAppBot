/**
 * Domain layer — FollowUpSuggestion (Fase D of docs/SPEC_CONVERSACION_GUIADA.md, section 7)
 *
 * A suggestion to retake a conversation that has gone cold. It is never
 * sent by itself: it sits in a queue until a human approves (optionally
 * editing the text first) or discards it. Pure logic only.
 */
import type { RelationType } from '../../conversation-context/domain/ConversationContext';

export type FollowUpReason = 'flow_abandoned' | 'inactive_lead';
export type FollowUpStatus = 'pending' | 'sent' | 'discarded';

export interface FollowUpSuggestion {
    id: string;
    chatJid: string;
    contactName: string;
    relationType: RelationType;
    reason: FollowUpReason;
    sourceFlowId?: string;
    suggestedMessage: string;
    status: FollowUpStatus;
    createdAt: string;
    updatedAt: string;
    respondedBy?: string;
    sentMessage?: string;
    discardReason?: string;
}

const MAX_MESSAGE_LENGTH = 1000;
const MAX_NAME_LENGTH = 100;

export function sanitizeContactName(name: string): string {
    if (!name || typeof name !== 'string') return 'Contacto';
    return name.trim().replace(/[<>"'&]/g, '').slice(0, MAX_NAME_LENGTH) || 'Contacto';
}

export function createSuggestion(
    chatJid: string,
    contactName: string,
    relationType: RelationType,
    reason: FollowUpReason,
    suggestedMessage: string,
    sourceFlowId?: string,
    now: string = new Date().toISOString()
): FollowUpSuggestion {
    return {
        id: `followup-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        chatJid,
        contactName: sanitizeContactName(contactName),
        relationType,
        reason,
        sourceFlowId,
        suggestedMessage: suggestedMessage.trim().slice(0, MAX_MESSAGE_LENGTH),
        status: 'pending',
        createdAt: now,
        updatedAt: now
    };
}

/**
 * A human approved the suggestion (optionally editing the text) and it was
 * actually sent — never called by the sweep itself.
 */
export function markSent(
    suggestion: FollowUpSuggestion,
    sentMessage: string,
    respondedBy: string,
    now: string = new Date().toISOString()
): FollowUpSuggestion {
    suggestion.status = 'sent';
    suggestion.sentMessage = sentMessage.trim().slice(0, MAX_MESSAGE_LENGTH);
    suggestion.respondedBy = respondedBy;
    suggestion.updatedAt = now;
    return suggestion;
}

export function discardSuggestion(
    suggestion: FollowUpSuggestion,
    respondedBy: string,
    reason?: string,
    now: string = new Date().toISOString()
): FollowUpSuggestion {
    suggestion.status = 'discarded';
    suggestion.respondedBy = respondedBy;
    if (reason) suggestion.discardReason = reason.trim().slice(0, MAX_MESSAGE_LENGTH);
    suggestion.updatedAt = now;
    return suggestion;
}

export type { RelationType };
