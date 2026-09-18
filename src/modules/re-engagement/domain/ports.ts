import type { FollowUpSuggestion } from './FollowUpSuggestion';

export interface FollowUpRepository {
    findAll(): FollowUpSuggestion[];
    findPending(): FollowUpSuggestion[];
    findById(id: string): FollowUpSuggestion | null;
    /** For weekly rate limiting (spec section 7 and 10). */
    findRecentByChat(chatJid: string, sinceIso: string): FollowUpSuggestion[];
    save(suggestion: FollowUpSuggestion): void;
}

/**
 * Generates the suggested follow-up text. The default adapter is a plain
 * template (infrastructure/TemplateMessageGenerator.ts); the spec's
 * "vía Gemini" wording (section 7) is intentionally left as a swappable
 * adapter behind this port rather than a hard dependency, since wiring the
 * existing GeminiAgent here would couple this module to BotOrchestrator's
 * composition — a future adapter can implement this port with Gemini
 * without touching domain or application code.
 */
export interface MessageGenerator {
    generate(input: {
        contactName: string;
        relationType: string;
        summary: string;
        reason: 'flow_abandoned' | 'inactive_lead';
        flowLabel?: string;
    }): Promise<string>;
}

/**
 * Sending is always a consequence of a human approving a suggestion
 * (never called by the sweep). Kept behind a port so this module does not
 * depend on BotService directly — the composition root wires the real
 * WhatsApp adapter in (see infrastructure/BotServiceMessageSender.ts).
 */
export interface MessageSender {
    send(chatJid: string, message: string): Promise<void>;
}
