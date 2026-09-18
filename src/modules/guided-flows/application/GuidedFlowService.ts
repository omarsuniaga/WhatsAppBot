/**
 * Application layer — use cases for the guided-flows module (Fase B).
 *
 * Two responsibilities, both here for simplicity since they share state:
 *  - CRUD for GuidedFlow configuration (used by the dashboard editor)
 *  - The engine that, given a chat's detected intent, decides whether a
 *    flow should start, continue, or succeed (used by BotOrchestrator)
 *
 * Depends only on the repository ports, never on the JSON adapters.
 */
import { EventEmitter } from 'events';
import {
    GuidedFlow,
    FlowState,
    RelationType,
    DetectedIntent,
    selectFlow,
    isSuccess,
    advanceFlowState,
    completeFlowState,
    abandonFlowState,
    createFlowState,
    nextGuidingQuestion,
    sanitizeFlowInput,
    isValidFlowId
} from '../domain/GuidedFlow';
import { GuidedFlowRepository, FlowStateRepository } from '../domain/ports';
import { JsonGuidedFlowRepository } from '../infrastructure/JsonGuidedFlowRepository';
import { JsonFlowStateRepository } from '../infrastructure/JsonFlowStateRepository';

export interface FlowEvaluationResult {
    event: 'none' | 'started' | 'continued' | 'success';
    flow: GuidedFlow | null;
    state: FlowState | null;
    nextGuidingQuestion: string | null;
    /** Only set when event === 'success'; the action Fase C should perform. */
    onSuccessAction?: string;
}

class GuidedFlowService extends EventEmitter {
    private static instance: GuidedFlowService;

    constructor(
        private readonly flowRepository: GuidedFlowRepository,
        private readonly stateRepository: FlowStateRepository
    ) {
        super();
    }

    static getInstance(): GuidedFlowService {
        if (!GuidedFlowService.instance) {
            GuidedFlowService.instance = new GuidedFlowService(
                new JsonGuidedFlowRepository(),
                new JsonFlowStateRepository()
            );
        }
        return GuidedFlowService.instance;
    }

    // ==========================================
    // CRUD (dashboard editor)
    // ==========================================

    getAllFlows(): GuidedFlow[] {
        return this.flowRepository.findAll();
    }

    getFlow(id: string): GuidedFlow | null {
        return this.flowRepository.findById(id);
    }

    createFlow(id: string, input: Partial<GuidedFlow>): GuidedFlow | null {
        if (!isValidFlowId(id) || this.flowRepository.findById(id)) return null;

        const sanitized = sanitizeFlowInput(input);
        const now = new Date().toISOString();
        const flow: GuidedFlow = { id, ...sanitized, createdAt: now, updatedAt: now };

        this.flowRepository.save(flow);
        this.emit('flow:created', flow);
        return flow;
    }

    updateFlow(id: string, input: Partial<GuidedFlow>): GuidedFlow | null {
        const existing = this.flowRepository.findById(id);
        if (!existing) return null;

        const sanitized = sanitizeFlowInput({ ...existing, ...input });
        const flow: GuidedFlow = {
            ...existing,
            ...sanitized,
            updatedAt: new Date().toISOString()
        };

        this.flowRepository.save(flow);
        this.emit('flow:updated', flow);
        return flow;
    }

    setActive(id: string, active: boolean): GuidedFlow | null {
        return this.updateFlow(id, { active });
    }

    deleteFlow(id: string): boolean {
        const deleted = this.flowRepository.delete(id);
        if (deleted) this.emit('flow:deleted', id);
        return deleted;
    }

    // ==========================================
    // Engine (called from BotOrchestrator on every inbound message)
    // ==========================================

    /**
     * NOTE: abandon detection (spec section 7 — silence timeout) is not
     * evaluated here on purpose: an inbound message means the chat is not
     * silent. It belongs to a scheduled sweep, which is Fase D's
     * re-engagement job, not this per-message engine.
     */
    evaluateMessage(
        chatJid: string,
        relationType: RelationType,
        detectedIntent: DetectedIntent
    ): FlowEvaluationResult {
        const existingState = this.stateRepository.findByChat(chatJid);

        if (existingState && existingState.status === 'active') {
            const flow = this.flowRepository.findById(existingState.flowId);
            if (!flow) {
                // Flow was deleted/deactivated after the state was created; drop it.
                return { event: 'none', flow: null, state: null, nextGuidingQuestion: null };
            }

            advanceFlowState(existingState, detectedIntent.entities);

            if (isSuccess(flow, existingState.accumulatedEntities)) {
                completeFlowState(existingState);
                this.stateRepository.save(existingState);
                this.emit('flow:success', { chatJid, flow, state: existingState });
                return {
                    event: 'success',
                    flow,
                    state: existingState,
                    nextGuidingQuestion: null,
                    onSuccessAction: flow.successCondition.onSuccess
                };
            }

            this.stateRepository.save(existingState);
            return {
                event: 'continued',
                flow,
                state: existingState,
                nextGuidingQuestion: nextGuidingQuestion(flow, existingState)
            };
        }

        const flows = this.flowRepository.findAll();
        const matchedFlow = selectFlow(flows, relationType, detectedIntent.label);
        if (!matchedFlow) {
            return { event: 'none', flow: null, state: null, nextGuidingQuestion: null };
        }

        const state = createFlowState(chatJid, matchedFlow.id);
        advanceFlowState(state, detectedIntent.entities);
        this.stateRepository.save(state);
        this.emit('flow:started', { chatJid, flow: matchedFlow, state });

        return {
            event: 'started',
            flow: matchedFlow,
            state,
            nextGuidingQuestion: nextGuidingQuestion(matchedFlow, state)
        };
    }

    getState(chatJid: string): FlowState | null {
        return this.stateRepository.findByChat(chatJid);
    }

    /**
     * All currently-active flow states, for the re-engagement sweep
     * (Fase D) to check against each flow's abandonCondition.
     */
    getActiveStates(): FlowState[] {
        return this.stateRepository.findAll().filter(s => s.status === 'active');
    }

    /**
     * Mark an active flow as abandoned (called by the Fase D sweep once it
     * has independently verified the chat has been silent long enough —
     * this service does not read timestamps itself, see domain/isAbandoned).
     */
    abandonFlow(chatJid: string): FlowState | null {
        const state = this.stateRepository.findByChat(chatJid);
        if (!state || state.status !== 'active') return null;

        abandonFlowState(state);
        this.stateRepository.save(state);
        this.emit('flow:abandoned', state);
        return state;
    }
}

export default GuidedFlowService;
export type { GuidedFlow, FlowState, SuccessCondition, AbandonCondition, FlowStateStatus } from '../domain/GuidedFlow';
