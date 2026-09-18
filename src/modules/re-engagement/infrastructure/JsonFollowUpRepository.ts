/**
 * Driven adapter — FollowUpSuggestion queue persisted as JSON
 * (data/follow-up-suggestions.json).
 *
 * Kept as its own file rather than folded into data/pending-alerts.json:
 * PendingAlert's schema requires a Gemini escalation analysis that doesn't
 * apply to a re-engagement suggestion, and extending it would mean
 * changing PendingAlertService's existing, working schema. A dedicated
 * queue keeps Fase D additive, matching the "no rompe nada existente"
 * principle applied to Fases A–C.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import type { FollowUpSuggestion } from '../domain/FollowUpSuggestion';
import type { FollowUpRepository } from '../domain/ports';

interface FollowUpData {
    version: number;
    suggestions: Record<string, FollowUpSuggestion>;
}

const DATA_PATH = join(process.cwd(), 'data', 'follow-up-suggestions.json');

export class JsonFollowUpRepository implements FollowUpRepository {
    private data: FollowUpData;

    constructor() {
        this.data = this.load();
    }

    private load(): FollowUpData {
        try {
            if (existsSync(DATA_PATH)) {
                return JSON.parse(readFileSync(DATA_PATH, 'utf-8'));
            }
        } catch (error) {
            console.error('[JsonFollowUpRepository] Error loading data:', error);
        }

        return { version: 1, suggestions: {} };
    }

    private persist(): void {
        try {
            const dir = dirname(DATA_PATH);
            if (!existsSync(dir)) {
                mkdirSync(dir, { recursive: true });
            }
            writeFileSync(DATA_PATH, JSON.stringify(this.data, null, 2));
        } catch (error) {
            console.error('[JsonFollowUpRepository] Error saving data:', error);
        }
    }

    findAll(): FollowUpSuggestion[] {
        return Object.values(this.data.suggestions).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }

    findPending(): FollowUpSuggestion[] {
        return this.findAll().filter(s => s.status === 'pending');
    }

    findById(id: string): FollowUpSuggestion | null {
        return this.data.suggestions[id] || null;
    }

    findRecentByChat(chatJid: string, sinceIso: string): FollowUpSuggestion[] {
        return Object.values(this.data.suggestions).filter(
            s => s.chatJid === chatJid && s.createdAt >= sinceIso
        );
    }

    save(suggestion: FollowUpSuggestion): void {
        this.data.suggestions[suggestion.id] = suggestion;
        this.persist();
    }
}
