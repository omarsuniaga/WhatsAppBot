/**
 * Application layer — use cases for the re-engagement module (Fase D of
 * docs/SPEC_CONVERSACION_GUIADA.md, section 7).
 *
 * This service reads from two other modules' application services
 * (ConversationContextService from Fase A, GuidedFlowService from Fase B)
 * as already-instantiated collaborators, the same way BotOrchestrator
 * composes every module — this is orchestration across modules, not a
 * dependency of one module's domain on another's internals. Its own
 * persistence and messaging stay behind ports (FollowUpRepository,
 * MessageGenerator, MessageSender) like every other module here.
 */
import { EventEmitter } from 'events';
import {
    FollowUpSuggestion,
    createSuggestion,
    markSent,
    discardSuggestion
} from '../domain/FollowUpSuggestion';
import { FollowUpRepository, MessageGenerator, MessageSender } from '../domain/ports';
import { JsonFollowUpRepository } from '../infrastructure/JsonFollowUpRepository';
import { TemplateMessageGenerator } from '../infrastructure/TemplateMessageGenerator';
import { BotServiceMessageSender } from '../infrastructure/BotServiceMessageSender';
import ConversationContextService from '../../conversation-context/application/ConversationContextService';
import GuidedFlowService from '../../guided-flows/application/GuidedFlowService';
import { isAbandoned } from '../../guided-flows/domain/GuidedFlow';

// A lead without an active guided flow counts as "gone cold" after this
// many hours of silence (spec section 7, "leads" case).
const DEFAULT_LEAD_SILENCE_HOURS = 48;
// Max follow-up suggestions generated per chat per week (spec sections 7/10,
// anti-spam risk mitigation).
const WEEKLY_SUGGESTION_LIMIT = 1;

class ReEngagementService extends EventEmitter {
    private static instance: ReEngagementService;
    private sweepInterval: ReturnType<typeof setInterval> | null = null;

    constructor(
        private readonly followUpRepository: FollowUpRepository,
        private readonly contextService: ConversationContextService,
        private readonly guidedFlowService: GuidedFlowService,
        private readonly messageGenerator: MessageGenerator,
        private readonly messageSender: MessageSender
    ) {
        super();
    }

    static getInstance(): ReEngagementService {
        if (!ReEngagementService.instance) {
            ReEngagementService.instance = new ReEngagementService(
                new JsonFollowUpRepository(),
                ConversationContextService.getInstance(),
                GuidedFlowService.getInstance(),
                new TemplateMessageGenerator(),
                new BotServiceMessageSender()
            );
        }
        return ReEngagementService.instance;
    }

    /** Start the periodic silence sweep. Idempotent. */
    start(intervalMs: number = 60 * 60 * 1000): void {
        if (this.sweepInterval) return;
        this.sweepInterval = setInterval(() => {
            this.sweep().catch(error => console.error('[ReEngagementService] Sweep failed:', error));
        }, intervalMs);
        console.log(`[ReEngagementService] Silence sweep scheduled every ${Math.round(intervalMs / 60000)}min`);
    }

    stop(): void {
        if (this.sweepInterval) {
            clearInterval(this.sweepInterval);
            this.sweepInterval = null;
        }
    }

    private hasRecentSuggestion(chatJid: string): boolean {
        const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        return this.followUpRepository.findRecentByChat(chatJid, oneWeekAgo).length >= WEEKLY_SUGGESTION_LIMIT;
    }

    private async suggestFollowUp(
        chatJid: string,
        contactName: string,
        relationType: import('../../conversation-context/domain/ConversationContext').RelationType,
        reason: 'flow_abandoned' | 'inactive_lead',
        summary: string,
        sourceFlowId?: string,
        flowLabel?: string
    ): Promise<FollowUpSuggestion | null> {
        if (this.hasRecentSuggestion(chatJid)) return null;

        const message = await this.messageGenerator.generate({ contactName, relationType, summary, reason, flowLabel });
        const suggestion = createSuggestion(chatJid, contactName, relationType, reason, message, sourceFlowId);
        this.followUpRepository.save(suggestion);
        this.emit('followup:created', suggestion);
        return suggestion;
    }

    /**
     * Scans for silence and queues follow-up suggestions. Never sends
     * anything itself (spec section 7 and 10: always human-approved).
     */
    async sweep(): Promise<{ abandonedFlows: number; leadsSuggested: number }> {
        const now = new Date().toISOString();
        let abandonedFlows = 0;
        let leadsSuggested = 0;

        // Case 1: active guided flows that have gone silent past their
        // own abandonCondition.silenceHours.
        for (const state of this.guidedFlowService.getActiveStates()) {
            const flow = this.guidedFlowService.getFlow(state.flowId);
            if (!flow) continue;

            const context = this.contextService.getContext(state.chatJid);
            if (!context || context.optedOut) continue;

            if (!isAbandoned(flow, context.lastInboundAt, now)) continue;

            this.guidedFlowService.abandonFlow(state.chatJid);
            abandonedFlows++;

            if (flow.abandonCondition.onAbandon === 'sugerir_seguimiento') {
                await this.suggestFollowUp(
                    state.chatJid,
                    context.contactProfile.displayName,
                    context.contactProfile.relationType,
                    'flow_abandoned',
                    context.summary,
                    flow.id,
                    flow.label
                );
            }
        }

        // Case 2: known contacts (not "desconocido") with no active flow
        // that have simply gone cold.
        for (const context of this.contextService.getAllContexts()) {
            if (context.optedOut) continue;
            if (context.contactProfile.relationType === 'desconocido') continue;
            if (this.guidedFlowService.getState(context.chatJid)?.status === 'active') continue;
            if (!context.lastInboundAt) continue;

            const elapsedHours = (new Date(now).getTime() - new Date(context.lastInboundAt).getTime()) / (1000 * 60 * 60);
            if (elapsedHours < DEFAULT_LEAD_SILENCE_HOURS) continue;

            const created = await this.suggestFollowUp(
                context.chatJid,
                context.contactProfile.displayName,
                context.contactProfile.relationType,
                'inactive_lead',
                context.summary
            );
            if (created) leadsSuggested++;
        }

        return { abandonedFlows, leadsSuggested };
    }

    // ==========================================
    // Dashboard-facing use cases (human approval)
    // ==========================================

    getAll(): FollowUpSuggestion[] {
        return this.followUpRepository.findAll();
    }

    getPending(): FollowUpSuggestion[] {
        return this.followUpRepository.findPending();
    }

    /**
     * A human approves (optionally editing the text) and the message is
     * sent right away. This is the only path in the module that ever
     * calls MessageSender.
     */
    async approveAndSend(id: string, respondedBy: string, finalMessage?: string): Promise<FollowUpSuggestion | null> {
        const suggestion = this.followUpRepository.findById(id);
        if (!suggestion || suggestion.status !== 'pending') return null;

        const context = this.contextService.getContext(suggestion.chatJid);
        if (context?.optedOut) {
            // Safety net: opt-out could have been set after the suggestion
            // was queued. Never send in that case.
            return discardSuggestion(suggestion, respondedBy, 'Contacto marcado como no contactar');
        }

        const textToSend = (finalMessage || suggestion.suggestedMessage).trim();
        await this.messageSender.send(suggestion.chatJid, textToSend);

        markSent(suggestion, textToSend, respondedBy);
        this.followUpRepository.save(suggestion);
        this.emit('followup:sent', suggestion);
        return suggestion;
    }

    discard(id: string, respondedBy: string, reason?: string): FollowUpSuggestion | null {
        const suggestion = this.followUpRepository.findById(id);
        if (!suggestion || suggestion.status !== 'pending') return null;

        discardSuggestion(suggestion, respondedBy, reason);
        this.followUpRepository.save(suggestion);
        this.emit('followup:discarded', suggestion);
        return suggestion;
    }
}

export default ReEngagementService;
export type { FollowUpSuggestion, FollowUpReason, FollowUpStatus } from '../domain/FollowUpSuggestion';
