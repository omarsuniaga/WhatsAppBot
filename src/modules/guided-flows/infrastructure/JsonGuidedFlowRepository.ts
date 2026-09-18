/**
 * Driven adapter — GuidedFlow configuration persisted as JSON
 * (data/guided-flows.json, per spec section 8).
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import type { GuidedFlow } from '../domain/GuidedFlow';
import type { GuidedFlowRepository } from '../domain/ports';

interface GuidedFlowData {
    version: number;
    flows: Record<string, GuidedFlow>;
}

const DATA_PATH = join(process.cwd(), 'data', 'guided-flows.json');

export class JsonGuidedFlowRepository implements GuidedFlowRepository {
    private data: GuidedFlowData;

    constructor() {
        this.data = this.load();
    }

    private load(): GuidedFlowData {
        try {
            if (existsSync(DATA_PATH)) {
                return JSON.parse(readFileSync(DATA_PATH, 'utf-8'));
            }
        } catch (error) {
            console.error('[JsonGuidedFlowRepository] Error loading data:', error);
        }

        return { version: 1, flows: {} };
    }

    private persist(): void {
        try {
            const dir = dirname(DATA_PATH);
            if (!existsSync(dir)) {
                mkdirSync(dir, { recursive: true });
            }
            writeFileSync(DATA_PATH, JSON.stringify(this.data, null, 2));
        } catch (error) {
            console.error('[JsonGuidedFlowRepository] Error saving data:', error);
        }
    }

    findAll(): GuidedFlow[] {
        return Object.values(this.data.flows);
    }

    findById(id: string): GuidedFlow | null {
        return this.data.flows[id] || null;
    }

    save(flow: GuidedFlow): void {
        this.data.flows[flow.id] = flow;
        this.persist();
    }

    delete(id: string): boolean {
        if (!this.data.flows[id]) return false;
        delete this.data.flows[id];
        this.persist();
        return true;
    }
}
