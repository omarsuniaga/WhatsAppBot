/**
 * Domain layer — GuidedFlow (Fase B of docs/SPEC_CONVERSACION_GUIADA.md, section 5)
 *
 * A GuidedFlow is a configurable "target topic" (e.g. quoting a hotel
 * event) that the bot tries to steer a conversation towards, without any
 * code change: it is data, loaded from JSON and edited from the dashboard.
 *
 * Pure business logic only — no filesystem, no Express.
 */
import type { RelationType, DetectedIntent } from '../../conversation-context/domain/ConversationContext';

export interface SuccessCondition {
    requiredEntities: string[];
    onSuccess: string;
}

export interface AbandonCondition {
    silenceHours: number;
    onAbandon: string;
}

export interface GuidedFlow {
    id: string;
    label: string;
    appliesToRelationTypes: RelationType[];
    triggerIntents: string[];
    guidingQuestions: string[];
    successCondition: SuccessCondition;
    abandonCondition: AbandonCondition;
    tone: string;
    active: boolean;
    createdAt: string;
    updatedAt: string;
}

export type FlowStateStatus = 'active' | 'completed' | 'abandoned';

export interface FlowState {
    chatJid: string;
    flowId: string;
    status: FlowStateStatus;
    accumulatedEntities: Record<string, string>;
    startedAt: string;
    updatedAt: string;
}

const MAX_LABEL_LENGTH = 120;
const MAX_QUESTION_LENGTH = 300;
const MAX_QUESTIONS = 10;
const MAX_TONE_LENGTH = 60;

export function isValidFlowId(value: unknown): value is string {
    return typeof value === 'string' && /^[a-z0-9_-]{3,60}$/.test(value);
}

/**
 * Whether a flow is a candidate for a given chat: its relation-type filter
 * matches and the just-detected intent is one of its triggers.
 */
export function matchesFlow(flow: GuidedFlow, relationType: RelationType, intentLabel: string): boolean {
    if (!flow.active) return false;
    if (flow.appliesToRelationTypes.length > 0 && !flow.appliesToRelationTypes.includes(relationType)) {
        return false;
    }
    return flow.triggerIntents.includes(intentLabel);
}

/**
 * Pick the first active flow that matches, in list order (config order acts
 * as priority — the dashboard editor controls that order).
 */
export function selectFlow(flows: GuidedFlow[], relationType: RelationType, intentLabel: string): GuidedFlow | null {
    return flows.find(f => matchesFlow(f, relationType, intentLabel)) || null;
}

export function mergeEntities(
    existing: Record<string, string>,
    incoming: Record<string, string>
): Record<string, string> {
    return { ...existing, ...incoming };
}

/**
 * A flow succeeds once every entity its successCondition asks for has been
 * captured at some point in the conversation (spec section 6: this is what
 * triggers Fase C's Appointment creation).
 */
export function isSuccess(flow: GuidedFlow, accumulatedEntities: Record<string, string>): boolean {
    if (flow.successCondition.requiredEntities.length === 0) return false;
    return flow.successCondition.requiredEntities.every(key => Boolean(accumulatedEntities[key]));
}

export function createFlowState(chatJid: string, flowId: string, now: string = new Date().toISOString()): FlowState {
    return {
        chatJid,
        flowId,
        status: 'active',
        accumulatedEntities: {},
        startedAt: now,
        updatedAt: now
    };
}

export function advanceFlowState(
    state: FlowState,
    newEntities: Record<string, string>,
    now: string = new Date().toISOString()
): FlowState {
    state.accumulatedEntities = mergeEntities(state.accumulatedEntities, newEntities);
    state.updatedAt = now;
    return state;
}

export function completeFlowState(state: FlowState, now: string = new Date().toISOString()): FlowState {
    state.status = 'completed';
    state.updatedAt = now;
    return state;
}

export function abandonFlowState(state: FlowState, now: string = new Date().toISOString()): FlowState {
    state.status = 'abandoned';
    state.updatedAt = now;
    return state;
}

/**
 * Whether an active flow has been silent long enough to count as abandoned
 * (spec section 7). `lastInboundAt` should come from the chat's
 * ConversationContext (Fase A), since that is what actually reflects
 * customer silence — the flow state's own updatedAt does not.
 */
export function isAbandoned(
    flow: GuidedFlow,
    lastInboundAt: string | null,
    now: string = new Date().toISOString()
): boolean {
    const reference = lastInboundAt ? new Date(lastInboundAt).getTime() : NaN;
    if (Number.isNaN(reference)) return false;

    const elapsedHours = (new Date(now).getTime() - reference) / (1000 * 60 * 60);
    return elapsedHours >= flow.abandonCondition.silenceHours;
}

/**
 * Pick the next guiding question to ask: the first one not yet "answered"
 * (heuristic: one question answered per captured entity so far). This is a
 * simple v1 — Fase B does not attempt real slot-filling NLU.
 */
export function nextGuidingQuestion(flow: GuidedFlow, state: FlowState): string | null {
    const answeredCount = Object.keys(state.accumulatedEntities).length;
    return flow.guidingQuestions[answeredCount] ?? flow.guidingQuestions[flow.guidingQuestions.length - 1] ?? null;
}

export function sanitizeFlowInput(input: Partial<GuidedFlow>): {
    label: string;
    appliesToRelationTypes: RelationType[];
    triggerIntents: string[];
    guidingQuestions: string[];
    successCondition: SuccessCondition;
    abandonCondition: AbandonCondition;
    tone: string;
    active: boolean;
} {
    return {
        label: (input.label || '').trim().slice(0, MAX_LABEL_LENGTH) || 'Flujo sin nombre',
        appliesToRelationTypes: Array.isArray(input.appliesToRelationTypes) ? input.appliesToRelationTypes : [],
        triggerIntents: Array.isArray(input.triggerIntents)
            ? input.triggerIntents.map(i => String(i).trim().toLowerCase()).filter(Boolean)
            : [],
        guidingQuestions: Array.isArray(input.guidingQuestions)
            ? input.guidingQuestions.slice(0, MAX_QUESTIONS).map(q => String(q).trim().slice(0, MAX_QUESTION_LENGTH)).filter(Boolean)
            : [],
        successCondition: {
            requiredEntities: Array.isArray(input.successCondition?.requiredEntities)
                ? input.successCondition!.requiredEntities.map(e => String(e).trim()).filter(Boolean)
                : [],
            onSuccess: (input.successCondition?.onSuccess || 'crear_cita_propuesta').trim()
        },
        abandonCondition: {
            silenceHours: Number.isFinite(input.abandonCondition?.silenceHours)
                ? Math.max(1, Number(input.abandonCondition!.silenceHours))
                : 48,
            onAbandon: (input.abandonCondition?.onAbandon || 'sugerir_seguimiento').trim()
        },
        tone: (input.tone || 'profesional_cordial').trim().slice(0, MAX_TONE_LENGTH),
        active: input.active !== undefined ? Boolean(input.active) : true
    };
}

export type { RelationType, DetectedIntent };
