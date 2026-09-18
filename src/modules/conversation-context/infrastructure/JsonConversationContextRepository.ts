/**
 * Driven adapter — implements the ConversationContextRepository port using
 * a local JSON file, following the same persistence pattern as the rest of
 * the codebase (see PendingAlertService). Swapping this for a database
 * adapter later does not require touching domain or application code.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import type { ConversationContext } from '../domain/ConversationContext';
import type { ConversationContextRepository } from '../domain/ports';

interface ConversationContextData {
    version: number;
    contexts: Record<string, ConversationContext>;
}

const DATA_PATH = join(process.cwd(), 'data', 'conversation-context.json');

export class JsonConversationContextRepository implements ConversationContextRepository {
    private data: ConversationContextData;

    constructor() {
        this.data = this.load();
    }

    private load(): ConversationContextData {
        try {
            if (existsSync(DATA_PATH)) {
                return JSON.parse(readFileSync(DATA_PATH, 'utf-8'));
            }
        } catch (error) {
            console.error('[JsonConversationContextRepository] Error loading data:', error);
        }

        return { version: 1, contexts: {} };
    }

    private persist(): void {
        try {
            const dir = dirname(DATA_PATH);
            if (!existsSync(dir)) {
                mkdirSync(dir, { recursive: true });
            }
            writeFileSync(DATA_PATH, JSON.stringify(this.data, null, 2));
        } catch (error) {
            console.error('[JsonConversationContextRepository] Error saving data:', error);
        }
    }

    findByJid(jid: string): ConversationContext | null {
        return this.data.contexts[jid] || null;
    }

    findAll(): ConversationContext[] {
        return Object.values(this.data.contexts);
    }

    save(context: ConversationContext): void {
        this.data.contexts[context.chatJid] = context;
        this.persist();
    }
}
