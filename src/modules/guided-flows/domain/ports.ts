import type { GuidedFlow, FlowState } from './GuidedFlow';

export interface GuidedFlowRepository {
    findAll(): GuidedFlow[];
    findById(id: string): GuidedFlow | null;
    save(flow: GuidedFlow): void;
    delete(id: string): boolean;
}

export interface FlowStateRepository {
    findByChat(chatJid: string): FlowState | null;
    findAll(): FlowState[];
    save(state: FlowState): void;
}
