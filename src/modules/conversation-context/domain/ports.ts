/**
 * Output port — the application layer depends on this interface, never on
 * a concrete storage technology. `JsonConversationContextRepository` in
 * `infrastructure/` is today's adapter; swapping to a database later means
 * writing a new adapter, not touching domain or application code.
 */
import type { ConversationContext } from './ConversationContext';

export interface ConversationContextRepository {
    findByJid(jid: string): ConversationContext | null;
    findAll(): ConversationContext[];
    save(context: ConversationContext): void;
}
