/**
 * Driven adapter — per-chat FlowState persisted as JSON
 * (data/guided-flow-state.json). Kept separate from guided-flows.json
 * because state is runtime data, not configuration.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import type { FlowState } from '../domain/GuidedFlow';
import type { FlowStateRepository } from '../domain/ports';

interface FlowStateData {
    version: number;
    states: Record<string, FlowState>;
}

const DATA_PATH = join(process.cwd(), 'data', 'guided-flow-state.json');

export class JsonFlowStateRepository implements FlowStateRepository {
    private data: FlowStateData;

    constructor() {
        this.data = this.load();
    }

    private load(): FlowStateData {
        try {
            if (existsSync(DATA_PATH)) {
                return JSON.parse(readFileSync(DATA_PATH, 'utf-8'));
            }
        } catch (error) {
            console.error('[JsonFlowStateRepository] Error loading data:', error);
        }

        return { version: 1, states: {} };
    }

    private persist(): void {
        try {
            const dir = dirname(DATA_PATH);
            if (!existsSync(dir)) {
                mkdirSync(dir, { recursive: true });
            }
            writeFileSync(DATA_PATH, JSON.stringify(this.data, null, 2));
        } catch (error) {
            console.error('[JsonFlowStateRepository] Error saving data:', error);
        }
    }

    findByChat(chatJid: string): FlowState | null {
        return this.data.states[chatJid] || null;
    }

    findAll(): FlowState[] {
        return Object.values(this.data.states);
    }

    save(state: FlowState): void {
        this.data.states[state.chatJid] = state;
        this.persist();
    }
}
